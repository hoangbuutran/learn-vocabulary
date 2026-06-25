/**
 * DataImporter - Handles importing vocabulary data from CSV, JSON, and TXT files.
 * Validates items, merges with existing vocabulary, and emits events on success.
 * All error messages are in Vietnamese.
 */
import eventBus from '../utils/event-bus.js';
import { generateId } from '../utils/helpers.js';
import storageManager from './storage-manager.js';

class DataImporter {
  /**
   * Parse CSV content into an ImportResult.
   * Expected format: word,meaning,example,pronunciation (header row optional)
   * @param {string} content - Raw CSV string
   * @returns {object} ImportResult
   */
  parseCSV(content) {
    const errors = [];
    const warnings = [];
    const items = [];

    if (!content || typeof content !== 'string' || content.trim() === '') {
      errors.push({ line: 0, message: 'Nội dung file CSV trống hoặc không hợp lệ' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) {
      errors.push({ line: 0, message: 'File CSV không chứa dữ liệu' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    // Detect if first line is a header row
    let startIndex = 0;
    const firstLine = lines[0].toLowerCase().trim();
    if (firstLine.includes('word') && firstLine.includes('meaning')) {
      startIndex = 1;
      warnings.push('Đã bỏ qua dòng tiêu đề (header)');
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;

      const fields = this._parseCSVLine(line);
      const lineNumber = i + 1;

      if (fields.length < 2) {
        errors.push({ line: lineNumber, message: `Dòng ${lineNumber}: cần ít nhất 2 trường (từ và nghĩa)` });
        continue;
      }

      const item = {
        word: fields[0].trim(),
        meaning: fields[1].trim(),
        examples: fields[2] ? this._parseExamples(fields[2].trim()) : [],
        pronunciation: fields[3] ? fields[3].trim() : undefined
      };

      const validationErrors = this.validateItem(item);
      if (validationErrors.length > 0) {
        for (const err of validationErrors) {
          errors.push({ line: lineNumber, message: `Dòng ${lineNumber}: ${err.message}` });
        }
        continue;
      }

      items.push(item);
    }

    if (items.length === 0) {
      errors.push({ line: 0, message: 'Không có mục từ vựng hợp lệ nào được tìm thấy' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    this._mergeAndSave(items);

    return { success: true, importedCount: items.length, errors, warnings };
  }

  /**
   * Parse JSON content into an ImportResult.
   * Accepts an array of objects or { items: [...] }
   * @param {string} content - Raw JSON string
   * @returns {object} ImportResult
   */
  parseJSON(content) {
    const errors = [];
    const warnings = [];
    const items = [];

    if (!content || typeof content !== 'string' || content.trim() === '') {
      errors.push({ line: 0, message: 'Nội dung file JSON trống hoặc không hợp lệ' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      errors.push({ line: 0, message: 'Không thể phân tích file JSON: cú pháp không hợp lệ' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    // Accept array or { items: [...] }
    let rawItems;
    if (Array.isArray(parsed)) {
      rawItems = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
      rawItems = parsed.items;
    } else {
      errors.push({ line: 0, message: 'Định dạng JSON không hợp lệ: cần mảng hoặc đối tượng có trường "items"' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    if (rawItems.length === 0) {
      errors.push({ line: 0, message: 'File JSON không chứa mục từ vựng nào' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      const lineNumber = i + 1;

      if (!raw || typeof raw !== 'object') {
        errors.push({ line: lineNumber, message: `Mục ${lineNumber}: không phải đối tượng hợp lệ` });
        continue;
      }

      const item = {
        word: raw.word ? String(raw.word).trim() : '',
        meaning: raw.meaning ? String(raw.meaning).trim() : '',
        examples: this._normalizeExamples(raw.examples),
        pronunciation: raw.pronunciation ? String(raw.pronunciation).trim() : undefined
      };

      const validationErrors = this.validateItem(item);
      if (validationErrors.length > 0) {
        for (const err of validationErrors) {
          errors.push({ line: lineNumber, message: `Mục ${lineNumber}: ${err.message}` });
        }
        continue;
      }

      items.push(item);
    }

    if (items.length === 0) {
      errors.push({ line: 0, message: 'Không có mục từ vựng hợp lệ nào được tìm thấy' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    this._mergeAndSave(items);

    return { success: true, importedCount: items.length, errors, warnings };
  }

  /**
   * Parse TXT content into an ImportResult.
   * Supports tab-separated or pipe-separated lines: word\tmeaning\texample\tpronunciation
   * @param {string} content - Raw TXT string
   * @returns {object} ImportResult
   */
  parseTXT(content) {
    const errors = [];
    const warnings = [];
    const items = [];

    if (!content || typeof content !== 'string' || content.trim() === '') {
      errors.push({ line: 0, message: 'Nội dung file TXT trống hoặc không hợp lệ' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) {
      errors.push({ line: 0, message: 'File TXT không chứa dữ liệu' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    // Detect separator: tab or pipe
    const separator = this._detectTXTSeparator(lines[0]);

    // Detect if first line is a header row
    let startIndex = 0;
    const firstLineLower = lines[0].toLowerCase().trim();
    if (firstLineLower.includes('word') && firstLineLower.includes('meaning')) {
      startIndex = 1;
      warnings.push('Đã bỏ qua dòng tiêu đề (header)');
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;

      const fields = line.split(separator).map(f => f.trim());
      const lineNumber = i + 1;

      if (fields.length < 2) {
        errors.push({ line: lineNumber, message: `Dòng ${lineNumber}: cần ít nhất 2 trường (từ và nghĩa)` });
        continue;
      }

      const item = {
        word: fields[0].trim(),
        meaning: fields[1].trim(),
        examples: fields[2] ? this._parseExamples(fields[2].trim()) : [],
        pronunciation: fields[3] ? fields[3].trim() : undefined
      };

      const validationErrors = this.validateItem(item);
      if (validationErrors.length > 0) {
        for (const err of validationErrors) {
          errors.push({ line: lineNumber, message: `Dòng ${lineNumber}: ${err.message}` });
        }
        continue;
      }

      items.push(item);
    }

    if (items.length === 0) {
      errors.push({ line: 0, message: 'Không có mục từ vựng hợp lệ nào được tìm thấy' });
      return { success: false, importedCount: 0, errors, warnings };
    }

    this._mergeAndSave(items);

    return { success: true, importedCount: items.length, errors, warnings };
  }

  /**
   * Validate a vocabulary item.
   * @param {object} item - Object with word, meaning, examples, pronunciation
   * @returns {Array} Array of ValidationError objects { message: string }
   */
  validateItem(item) {
    const errors = [];

    if (!item || typeof item !== 'object') {
      errors.push({ message: 'Mục không phải đối tượng hợp lệ' });
      return errors;
    }

    if (!item.word || typeof item.word !== 'string' || item.word.trim() === '') {
      errors.push({ message: 'Thiếu từ tiếng Anh (word)' });
    }

    if (!item.meaning || typeof item.meaning !== 'string' || item.meaning.trim() === '') {
      errors.push({ message: 'Thiếu nghĩa tiếng Việt (meaning)' });
    }

    // pronunciation is optional - no validation error if absent

    return errors;
  }

  /**
   * Import a file using the File API.
   * Determines format from file extension and delegates to the appropriate parser.
   * @param {File} file - File object from input or drag-and-drop
   * @returns {Promise<object>} ImportResult
   */
  async importFile(file) {
    if (!file) {
      return {
        success: false,
        importedCount: 0,
        errors: [{ line: 0, message: 'Không có file nào được chọn' }],
        warnings: []
      };
    }

    const extension = this._getFileExtension(file.name);
    if (!['csv', 'json', 'txt'].includes(extension)) {
      return {
        success: false,
        importedCount: 0,
        errors: [{ line: 0, message: 'Chỉ hỗ trợ file CSV, JSON, hoặc TXT' }],
        warnings: []
      };
    }

    let content;
    try {
      content = await this._readFileContent(file);
    } catch (e) {
      return {
        success: false,
        importedCount: 0,
        errors: [{ line: 0, message: 'Không thể đọc file. Vui lòng thử lại.' }],
        warnings: []
      };
    }

    let result;
    switch (extension) {
      case 'csv':
        result = this.parseCSV(content);
        break;
      case 'json':
        result = this.parseJSON(content);
        break;
      case 'txt':
        result = this.parseTXT(content);
        break;
      default:
        result = {
          success: false,
          importedCount: 0,
          errors: [{ line: 0, message: 'Chỉ hỗ trợ file CSV, JSON, hoặc TXT' }],
          warnings: []
        };
    }

    return result;
  }

  // --- Private Helper Methods ---

  /**
   * Parse a single CSV line handling quoted fields.
   * @param {string} line - A single CSV line
   * @returns {string[]} Array of field values
   */
  _parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current);

    return fields;
  }

  /**
   * Parse examples from a string (split by semicolons).
   * @param {string} examplesStr - Examples string separated by ;
   * @returns {string[]} Array of example sentences
   */
  _parseExamples(examplesStr) {
    if (!examplesStr) return [];
    return examplesStr.split(';').map(e => e.trim()).filter(e => e !== '');
  }

  /**
   * Normalize examples field from JSON - can be string or array.
   * @param {*} examples - String (split by ;) or array of strings
   * @returns {string[]} Array of example sentences
   */
  _normalizeExamples(examples) {
    if (!examples) return [];
    if (Array.isArray(examples)) {
      return examples.map(e => String(e).trim()).filter(e => e !== '');
    }
    if (typeof examples === 'string') {
      return this._parseExamples(examples);
    }
    return [];
  }

  /**
   * Detect the separator used in a TXT line (tab or pipe).
   * @param {string} line - First line of the TXT file
   * @returns {string|RegExp} Separator character or regex
   */
  _detectTXTSeparator(line) {
    if (line.includes('\t')) return '\t';
    if (line.includes('|')) return '|';
    // Default to tab
    return '\t';
  }

  /**
   * Get the lowercase file extension from a filename.
   * @param {string} filename - File name
   * @returns {string} Lowercase extension without dot
   */
  _getFileExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Read file content as text using the File API.
   * @param {File} file - File object
   * @returns {Promise<string>} File content as text
   */
  _readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    });
  }

  /**
   * Merge imported items with existing vocabulary and save.
   * Generates IDs for new items and appends to existing data.
   * Emits 'vocab:imported' event on success.
   * @param {Array} newItems - Validated vocabulary items to add
   */
  _mergeAndSave(newItems) {
    const existingItems = storageManager.getAllVocabulary();

    const itemsWithIds = newItems.map(item => ({
      id: item.id || generateId(),
      word: item.word,
      meaning: item.meaning,
      examples: item.examples || [],
      pronunciation: item.pronunciation || undefined,
      category: item.category || 'imported',
      groupIndex: item.groupIndex || 0
    }));

    const merged = [...existingItems, ...itemsWithIds];
    storageManager.saveVocabulary(merged);

    eventBus.emit('vocab:imported', { count: newItems.length, total: merged.length });
  }
}

// Export as singleton
const dataImporter = new DataImporter();
export default dataImporter;
export { DataImporter };

/**
 * Vocabulary Data Generation Script
 * 
 * This script extracts vocabulary from PDF source files and generates
 * structured JSON data files for the English Vocabulary App.
 * 
 * Source PDFs:
 * - 3000.pdf → data/vocabulary-3000.json
 * - Tong-hop-1000-tu-vung-tieng-anh-A1-A2.pdf → data/vocabulary-a1-a2.json
 * 
 * Usage: node scripts/generate-vocabulary.js
 * 
 * Requirements:
 * - pdf-parse (npm install pdf-parse)
 * - Node.js 18+
 * 
 * Note: This script is for DEVELOPMENT-TIME use only.
 * The generated JSON files are bundled with the app as static data.
 * No AI API calls or internet connection is needed at runtime.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

/**
 * Extract text content from a PDF file
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromPDF(pdfPath) {
  // pdf-parse is used for PDF text extraction
  // Install with: npm install pdf-parse
  let pdfParse;
  try {
    pdfParse = (await import('pdf-parse')).default;
  } catch (e) {
    console.error('Error: pdf-parse is not installed.');
    console.error('Run: npm install pdf-parse');
    process.exit(1);
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

/**
 * Parse extracted text into vocabulary items
 * This is a template parser - actual implementation depends on PDF format
 * @param {string} text - Raw text from PDF
 * @param {string} category - Category identifier
 * @returns {Array} - Array of vocabulary items
 */
function parseVocabularyFromText(text, category) {
  const items = [];
  // PDF parsing logic depends on the specific format of each PDF
  // Common patterns to look for:
  // - Word followed by pronunciation in brackets/slashes
  // - Vietnamese meaning after a separator (-, :, =)
  // - Example sentences on following lines
  
  // This is a placeholder showing the approach.
  // Actual parsing requires analyzing the specific PDF structure.
  console.log(`Parsing text for category: ${category}`);
  console.log(`Text length: ${text.length} characters`);
  
  return items;
}

/**
 * Generate a vocabulary item with all required fields
 * @param {object} params - Item parameters
 * @param {string} params.word - English word
 * @param {string} params.meaning - Vietnamese meaning
 * @param {string[]} params.examples - Example sentences (3)
 * @param {string} params.pronunciation - IPA pronunciation
 * @param {string} params.memoryTip - Memory tip in Vietnamese
 * @param {string} params.category - Category identifier
 * @param {number} params.groupIndex - Group index for daily sessions
 * @returns {object} - Formatted vocabulary item
 */
function createVocabularyItem({ word, meaning, examples, pronunciation, memoryTip, category, groupIndex }) {
  const index = String(groupIndex).padStart(4, '0');
  return {
    id: `${category}_${index}`,
    word,
    meaning,
    examples: examples.slice(0, 3),
    pronunciation,
    memoryTip,
    category,
    groupIndex
  };
}

/**
 * Write vocabulary data to a JSON file
 * @param {string} filename - Output filename
 * @param {object} metadata - File metadata
 * @param {Array} items - Vocabulary items
 */
function writeVocabularyFile(filename, metadata, items) {
  const outputPath = path.join(DATA_DIR, filename);
  const data = {
    metadata: {
      ...metadata,
      generatedAt: new Date().toISOString().split('T')[0],
      totalItems: items.length
    },
    items
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ Generated ${outputPath} (${items.length} items)`);
}

/**
 * Main generation pipeline
 */
async function main() {
  console.log('=== Vocabulary Data Generation ===\n');

  const pdf3000Path = path.join(ROOT_DIR, '3000.pdf');
  const pdfA1A2Path = path.join(ROOT_DIR, 'Tong-hop-1000-tu-vung-tieng-anh-A1-A2.pdf');

  // Check if PDFs exist
  if (!fs.existsSync(pdf3000Path)) {
    console.warn(`Warning: ${pdf3000Path} not found. Skipping 3000 essential extraction.`);
  }
  if (!fs.existsSync(pdfA1A2Path)) {
    console.warn(`Warning: ${pdfA1A2Path} not found. Skipping A1-A2 extraction.`);
  }

  // Process 3000 Essential Words PDF
  if (fs.existsSync(pdf3000Path)) {
    console.log('\n--- Processing 3000.pdf ---');
    try {
      const text = await extractTextFromPDF(pdf3000Path);
      const items = parseVocabularyFromText(text, 'essential-3000');
      
      if (items.length > 0) {
        writeVocabularyFile('vocabulary-3000.json', {
          source: '3000.pdf',
          categories: ['essential-3000']
        }, items);
      } else {
        console.log('No items extracted. Manual review of PDF format needed.');
        console.log('Using pre-generated sample data instead.');
      }
    } catch (err) {
      console.error(`Error processing 3000.pdf: ${err.message}`);
    }
  }

  // Process A1-A2 PDF
  if (fs.existsSync(pdfA1A2Path)) {
    console.log('\n--- Processing Tong-hop-1000-tu-vung-tieng-anh-A1-A2.pdf ---');
    try {
      const text = await extractTextFromPDF(pdfA1A2Path);
      const items = parseVocabularyFromText(text, 'a1-a2');
      
      if (items.length > 0) {
        writeVocabularyFile('vocabulary-a1-a2.json', {
          source: 'Tong-hop-1000-tu-vung-tieng-anh-A1-A2.pdf',
          categories: ['a1-a2']
        }, items);
      } else {
        console.log('No items extracted. Manual review of PDF format needed.');
        console.log('Using pre-generated sample data instead.');
      }
    } catch (err) {
      console.error(`Error processing A1-A2 PDF: ${err.message}`);
    }
  }

  console.log('\n=== Generation Complete ===');
  console.log('Note: If extraction produced no results, the PDF format needs');
  console.log('manual analysis. Use the pre-generated JSON files in data/.');
}

main().catch(console.error);

# Implementation Plan: English Vocabulary App

## Overview

Implement a browser-based English vocabulary learning app using Vanilla JS + ES Modules, event-driven architecture, SM-2 spaced repetition, static JSON data, LocalStorage persistence, and Web Speech API. Sequential implementation from core utilities through modules, views, styling, and testing.

## Tasks

- [x] 1. Project setup and core utilities
  - [x] 1.1 Create project file structure and index.html
    - Create directory structure: `css/`, `js/modules/`, `js/views/`, `js/utils/`, `data/`, `assets/icons/`, `tests/properties/`, `tests/unit/`, `tests/integration/`
    - Create `index.html` with app shell, navigation bar, view container, and script imports using ES Modules
    - Include all CSS file references and meta tags for responsive viewport
    - _Requirements: 8.1, 8.4, 9.1_

  - [x] 1.2 Create package.json and testing configuration
    - Create `package.json` with project metadata and test scripts
    - Add dependencies: `fast-check`, `vitest`, `jsdom` for testing
    - Configure vitest for ES Modules and jsdom environment
    - _Requirements: 9.1_

  - [x] 1.3 Implement EventBus utility (js/utils/event-bus.js)
    - Implement pub/sub pattern: `on(event, callback)`, `off(event, callback)`, `emit(event, data)`
    - Export as singleton instance
    - _Requirements: 9.1, 9.2_

  - [x] 1.4 Implement helpers utility (js/utils/helpers.js)
    - Create utility functions: `generateId()`, `formatDate()`, `debounce()`, `showError()`, `showWarning()`, `showSuccess()` notification functions
    - All user-facing messages in Vietnamese
    - _Requirements: 8.4_

- [x] 2. Storage Manager module
  - [x] 2.1 Implement StorageManager (js/modules/storage-manager.js)
    - Implement `getAllVocabulary()`, `getVocabularyByCategory()`, `saveVocabulary()`
    - Implement `getProgress()`, `getAllProgress()`, `saveProgress()`
    - Implement `getSettings()`, `saveSettings()` with default AppSettings
    - Implement `isFirstRun()`, `loadPreGeneratedData()` to fetch and store static JSON
    - Implement `exportAllData()`, `importData()` for full state export/import
    - Handle QuotaExceededError gracefully with Vietnamese warning
    - Use LocalStorage keys: `vocab_items`, `vocab_progress`, `app_settings`, `daily_sessions`, `data_loaded`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 12.1, 12.2, 13.3_

  - [ ]* 2.2 Write property test: LocalStorage Persistence Round-Trip
    - **Property 8: LocalStorage Persistence Round-Trip**
    - Use fast-check arbitrary generators for VocabularyItem and ProgressRecord
    - Verify save then restore produces equivalent data
    - **Validates: Requirements 7.1, 7.2**

- [x] 3. Memory System and Spaced Repetition
  - [x] 3.1 Implement SpacedRepetitionEngine (js/modules/spaced-repetition.js)
    - Implement SM-2 algorithm: `calculateNextReview(itemId, quality)` with quality mapping (remembered=4, not remembered=1)
    - Implement interval logic: rep0→1day, rep1→6days, else→interval*easeFactor
    - Implement `getItemsDueForReview(date)`, `getReviewSchedule()`
    - Implement `resetInterval()`, `increaseInterval()`
    - EaseFactor minimum clamped at 1.3
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 3.2 Write property test: SM-2 Algorithm Correctness
    - **Property 10: SM-2 Algorithm Correctness**
    - Verify remembered (quality≥3) produces strictly greater interval for repetitions>0
    - Verify easeFactor never goes below 1.3
    - **Validates: Requirements 11.1, 11.2**

  - [ ]* 3.3 Write property test: SM-2 Reset on Failure
    - **Property 11: SM-2 Reset on Failure**
    - Verify not-remembered (quality<3) resets repetitions to 0 and interval to 1
    - **Validates: Requirements 11.3**

  - [ ]* 3.4 Write property test: Review Due Date Filtering
    - **Property 12: Review Due Date Filtering**
    - Verify `getItemsDueForReview(date)` returns exactly items where nextReviewDate <= date
    - **Validates: Requirements 11.4**

  - [x] 3.5 Implement MemorySystem (js/modules/memory-system.js)
    - Implement `markRemembered(itemId)`, `markNotRemembered(itemId)`, `getStatus(itemId)`
    - Implement `getStats()` returning total, studied, remembered, notRemembered, progressPercentage
    - Implement `getWordsForStudy(count)` with bias toward not-remembered words
    - Implement `getWordsForReview()`, `getDailyWords(date)` with daily session tracking
    - Implement `recordPronunciationAttempt()`, `isPronunciationPassed()`, `canMarkAsCompleted()`
    - Completion gate: meaningViewed AND pronunciationListened AND pronunciationPassed
    - Emit `progress:updated` events via EventBus
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 10.1, 10.3, 15.7, 15.8_

  - [ ]* 3.6 Write property test: Memory Status Invariant
    - **Property 5: Memory Status Invariant**
    - Verify status is always one of three values after any sequence of mark operations
    - **Validates: Requirements 5.1, 2.4, 2.5**

  - [ ]* 3.7 Write property test: Statistics Internal Consistency
    - **Property 6: Statistics Internal Consistency**
    - Verify total = studied + notStudied, studied = remembered + notRemembered
    - **Validates: Requirements 5.2, 6.3**

  - [ ]* 3.8 Write property test: Study Prioritization Bias
    - **Property 7: Study Prioritization Bias**
    - Verify not-remembered items appear with higher frequency over many samples
    - **Validates: Requirements 5.3**

  - [ ]* 3.9 Write property test: Daily Session Non-Overlap
    - **Property 9: Daily Session Non-Overlap**
    - Verify each item assigned to at most one session, sessions have at most dailyWordCount items
    - **Validates: Requirements 10.1, 10.3, 14.4**

  - [ ]* 3.10 Write property test: Completion Gate Logic
    - **Property 15: Completion Gate Logic**
    - Verify `canMarkAsCompleted` returns true iff all three conditions met
    - **Validates: Requirements 15.7**

- [x] 4. Checkpoint - Core modules verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Data Import and Quiz Engine
  - [x] 5.1 Implement DataImporter (js/modules/data-importer.js)
    - Implement `parseCSV(content)`, `parseJSON(content)`, `parseTXT(content)`
    - Implement `validateItem(item)` with Vietnamese error messages
    - Implement `importFile(file)` with File API reading
    - Return ImportResult with success, importedCount, errors, warnings
    - Never corrupt existing state on invalid input
    - Pronunciation field treated as optional
    - Emit `vocab:imported` event on success
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 5.2 Write property test: Data Import Round-Trip
    - **Property 1: Data Import Round-Trip**
    - Verify serialize to CSV/JSON/TXT then parse back produces equivalent items
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.6**

  - [ ]* 5.3 Write property test: Invalid Import Never Corrupts State
    - **Property 2: Invalid Import Never Corrupts State**
    - Verify malformed input returns success=false with non-empty errors, state unchanged
    - **Validates: Requirements 1.4, 12.3**

  - [x] 5.4 Implement QuizEngine (js/modules/quiz-engine.js)
    - Implement `generateQuiz(type, count)` for 'meaning_to_word' and 'word_to_meaning' types
    - Implement `generateDistractors(correctItem, count)` choosing 3 random incorrect options
    - Implement `startSession(type)`, `submitAnswer(questionId, answer)`, `endSession()`
    - Score calculation: correctCount and percentage = (correct/total)*100
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 5.5 Write property test: Quiz Question Structure Invariant
    - **Property 3: Quiz Question Structure Invariant**
    - Verify exactly 4 options, exactly 1 correct, correct maps to valid VocabularyItem
    - **Validates: Requirements 3.3, 3.1**

  - [ ]* 5.6 Write property test: Quiz Scoring Consistency
    - **Property 4: Quiz Scoring Consistency**
    - Verify score equals correct count, percentage equals (correct/total)*100
    - **Validates: Requirements 3.5, 3.6**

- [x] 6. Speech and Pronunciation modules
  - [x] 6.1 Implement SpeechModule (js/modules/speech-module.js)
    - Implement `speak(word, accent)` using Web Speech API SpeechSynthesis
    - Implement `setAccent(accent)` for 'en-US' and 'en-GB'
    - Implement `getAvailableVoices()`, `startRecognition()`, `stopRecognition()`
    - Implement `isRecognitionSupported()` for feature detection
    - Graceful degradation: disable features if API unavailable
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 15.1, 15.2_

  - [x] 6.2 Implement PronunciationValidator (js/modules/pronunciation-validator.js)
    - Implement `validate(targetWord, recognizedText)` with case-insensitive comparison
    - Implement `startValidation(targetWord)` orchestrating recognition + validation
    - Implement `getAttemptCount(itemId)`, `getFirstSuccessDate(itemId)`
    - Return ValidationResult with passed, targetWord, recognizedText, confidence
    - _Requirements: 15.3, 15.4, 15.5, 15.6_

  - [ ]* 6.3 Write property test: Pronunciation Validation Case-Insensitivity
    - **Property 14: Pronunciation Validation Case-Insensitivity**
    - Verify case-only differences produce passed=true, character differences produce passed=false
    - **Validates: Requirements 15.3, 15.4, 15.5**

- [x] 7. Checkpoint - All modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Pre-generated vocabulary data
  - [x] 8.1 Create data generation script and static JSON files
    - Create a Node.js script `scripts/generate-vocabulary.js` to extract vocabulary from PDF sources
    - Generate `data/vocabulary-3000.json` with metadata and items array following the Static JSON File Format
    - Generate `data/vocabulary-a1-a2.json` with metadata and items array
    - Each item: id, word, meaning, examples (3), pronunciation (IPA), memoryTip, category, groupIndex
    - _Requirements: 13.1, 13.2, 13.4, 13.5_

- [x] 9. UI Views implementation
  - [x] 9.1 Implement app router and shell (js/app.js)
    - Create simple hash-based router for view navigation
    - Initialize all modules on DOMContentLoaded
    - Trigger first-run data loading if `isFirstRun()`
    - Wire navigation bar click handlers to view switching
    - _Requirements: 9.1, 9.2, 13.3, 14.1, 14.2, 14.3_

  - [x] 9.2 Implement DashboardView (js/views/dashboard-view.js)
    - Display stats cards: total words, remembered, needing review, progress percentage
    - Show review reminder for items due today
    - Show daily progress summary
    - Listen to `progress:updated` and `review:due` events for real-time updates
    - _Requirements: 6.1, 6.2, 6.3, 11.4_

  - [x] 9.3 Implement FlashcardView (js/views/flashcard-view.js)
    - Display English word on front, Vietnamese meaning + example + pronunciation on back
    - Implement card flip on tap/click with CSS animation trigger
    - Add "Đã nhớ" and "Chưa nhớ" buttons on back face
    - Add pronunciation speaker button and microphone button
    - Integrate with MemorySystem, SpeechModule, PronunciationValidator
    - Show progress bar for current session
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.2, 15.1, 15.2_

  - [x] 9.4 Implement QuizView (js/views/quiz-view.js)
    - Display question card with prompt text
    - Show 4 option buttons in a grid layout
    - Highlight correct/incorrect on answer selection
    - Display running score during session
    - Show final results (score, percentage) on session end
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 9.5 Implement ImportExportView (js/views/import-view.js)
    - File upload input for CSV, JSON, TXT with drag-and-drop zone
    - Display import results (success count, errors in Vietnamese)
    - Export button to download full app state as JSON
    - Import button to restore from previously exported JSON
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 12.1, 12.2, 12.3_

  - [x] 9.6 Implement ReviewView (js/views/review-view.js)
    - Display items due for spaced repetition review
    - Integrate flashcard-like interface with "Đã nhớ"/"Chưa nhớ" buttons
    - Integrate speech and pronunciation validation
    - Show session completion when all due items reviewed
    - _Requirements: 11.4, 15.1, 15.7_

  - [x] 9.7 Implement SettingsView (js/views/settings-view.js)
    - Dark mode toggle
    - Accent selection (American/British English)
    - Daily word count configuration
    - Auto-play pronunciation toggle
    - Persist all settings via StorageManager
    - _Requirements: 8.2, 8.3, 4.3, 10.1_

- [x] 10. Styling and responsive design
  - [x] 10.1 Create main.css and themes.css
    - Define CSS custom properties for light and dark themes in `css/themes.css`
    - Implement base styles, typography, navigation, cards, buttons in `css/main.css`
    - Vietnamese-friendly font stack
    - Dark mode toggle applies `.dark-theme` class to body
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 10.2 Create flashcard.css with flip animations
    - CSS 3D transform for card flip animation
    - Front/back face styling with perspective
    - Smooth transition timing
    - _Requirements: 2.6_

  - [x] 10.3 Create responsive.css with media queries
    - Mobile-first approach, breakpoints at 320px, 768px, 1024px, 1920px
    - Adjust navigation, card grid, quiz layout for all screen sizes
    - Touch-friendly button sizes on mobile (min 44px tap targets)
    - _Requirements: 8.1_

- [ ] 11. Export/Import round-trip property test
  - [ ]* 11.1 Write property test: Export/Import Round-Trip
    - **Property 13: Export/Import Round-Trip**
    - Verify full app state export then import produces equivalent state
    - **Validates: Requirements 12.1, 12.2**

- [x] 12. Integration and wiring
  - [x] 12.1 Wire all modules together in app.js
    - Register all EventBus listeners across modules
    - Connect view buttons to module methods
    - Ensure first-run loads pre-generated data and initializes spaced repetition schedule
    - Verify navigation between all views works correctly
    - _Requirements: 9.1, 9.2, 14.1, 14.2, 14.3, 14.4_

  - [x]* 12.2 Write integration tests
    - Test DataImporter → StorageManager pipeline
    - Test MemorySystem → SpacedRepetition → StorageManager flow
    - Test first-run data loading sequence
    - Test daily session assignment flow
    - _Requirements: 7.1, 7.3, 11.1, 13.3_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use fast-check library and validate universal correctness properties from the design document
- All UI text in Vietnamese; error messages in Vietnamese
- The app runs entirely client-side with no backend dependency

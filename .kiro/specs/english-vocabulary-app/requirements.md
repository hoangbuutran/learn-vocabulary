# Requirements Document

## Introduction

Ứng dụng web học từ vựng tiếng Anh dành cho người mất gốc, giúp học và ghi nhớ từ vựng hiệu quả thông qua flashcard, trắc nghiệm, luyện nghe phát âm và hệ thống spaced repetition. Ứng dụng chạy hoàn toàn trên trình duyệt (client-side), không cần backend, sử dụng HTML, CSS và JavaScript (hoặc React). Giao diện tiếng Việt, responsive, hỗ trợ dark mode.

## Glossary

- **App**: Ứng dụng web học từ vựng tiếng Anh
- **Vocabulary_Item**: Một mục từ vựng gồm: từ tiếng Anh, nghĩa tiếng Việt, câu ví dụ, phiên âm (tùy chọn)
- **Flashcard_Module**: Module hiển thị thẻ từ vựng có thể lật để xem nghĩa
- **Quiz_Module**: Module trắc nghiệm tạo câu hỏi ngẫu nhiên từ danh sách từ vựng
- **Speech_Module**: Module phát âm sử dụng Web Speech API
- **Memory_System**: Hệ thống theo dõi tiến độ ghi nhớ từ vựng
- **Dashboard**: Trang tổng quan hiển thị thống kê học tập
- **Data_Importer**: Module import dữ liệu từ file CSV, JSON hoặc TXT
- **Storage_Manager**: Module quản lý lưu trữ dữ liệu trên Local Storage
- **Spaced_Repetition_Engine**: Hệ thống ôn tập tự động theo thuật toán lặp lại ngắt quãng
- **Pre_Generated_Data**: Dữ liệu từ vựng được trích xuất sẵn từ file PDF và lưu dưới dạng JSON tĩnh, đi kèm ứng dụng
- **Pronunciation_Validator**: Module kiểm tra phát âm sử dụng Web Speech API (SpeechRecognition) để nhận diện giọng nói và so sánh với từ mục tiêu

## Requirements

### Requirement 1: Import dữ liệu từ vựng

**User Story:** As a learner, I want to import vocabulary data from files, so that I can use my own word lists for studying.

#### Acceptance Criteria

1. WHEN a user uploads a CSV file, THE Data_Importer SHALL parse the file and extract Vocabulary_Item entries with fields: English word, Vietnamese meaning, example sentence, and pronunciation
2. WHEN a user uploads a JSON file, THE Data_Importer SHALL parse the file and extract Vocabulary_Item entries with fields: English word, Vietnamese meaning, example sentence, and pronunciation
3. WHEN a user uploads a TXT file, THE Data_Importer SHALL parse the file and extract Vocabulary_Item entries with fields: English word, Vietnamese meaning, example sentence, and pronunciation
4. IF an uploaded file contains invalid or malformed data, THEN THE Data_Importer SHALL display a descriptive error message in Vietnamese indicating the problem
5. WHEN Vocabulary_Item entries are successfully parsed, THE Data_Importer SHALL store them via the Storage_Manager
6. THE Data_Importer SHALL treat the pronunciation field as optional when parsing Vocabulary_Item entries

### Requirement 2: Flashcard học từ vựng

**User Story:** As a learner, I want to study vocabulary using flashcards, so that I can memorize words through active recall.

#### Acceptance Criteria

1. THE Flashcard_Module SHALL display the English word on the front face of each flashcard
2. WHEN the user taps or swipes a flashcard, THE Flashcard_Module SHALL flip the card to reveal: Vietnamese meaning, example sentence, and pronunciation
3. WHEN the flashcard back face is displayed, THE Flashcard_Module SHALL show a "Đã nhớ" (remembered) button and a "Chưa nhớ" (not remembered) button
4. WHEN the user presses "Đã nhớ", THE Memory_System SHALL mark the Vocabulary_Item as remembered
5. WHEN the user presses "Chưa nhớ", THE Memory_System SHALL mark the Vocabulary_Item as not remembered and increase its review frequency
6. THE Flashcard_Module SHALL animate the card flip transition with a smooth CSS animation

### Requirement 3: Trắc nghiệm

**User Story:** As a learner, I want to take quizzes on my vocabulary, so that I can test my knowledge and reinforce memory.

#### Acceptance Criteria

1. THE Quiz_Module SHALL generate random quiz questions from the stored Vocabulary_Item list
2. THE Quiz_Module SHALL support two question types: "Chọn nghĩa đúng" (select correct meaning) and "Chọn từ đúng" (select correct word)
3. FOR each question, THE Quiz_Module SHALL present exactly 4 answer options including one correct answer and three distractors
4. WHEN the user selects an answer, THE Quiz_Module SHALL immediately indicate whether the answer is correct or incorrect
5. THE Quiz_Module SHALL track and display the current score during a quiz session
6. WHEN a quiz session ends, THE Quiz_Module SHALL display the final score and percentage

### Requirement 4: Luyện nghe phát âm

**User Story:** As a learner, I want to listen to word pronunciations, so that I can learn correct English pronunciation.

#### Acceptance Criteria

1. THE Speech_Module SHALL use the Web Speech API (SpeechSynthesis) to pronounce English words
2. WHEN the user presses the pronunciation button, THE Speech_Module SHALL speak the English word aloud
3. THE Speech_Module SHALL provide an option to select between American English and British English voices
4. THE Speech_Module SHALL allow the user to replay pronunciation multiple times without limit

### Requirement 5: Hệ thống ghi nhớ

**User Story:** As a learner, I want the app to track my memorization progress, so that I can focus on words I haven't memorized yet.

#### Acceptance Criteria

1. THE Memory_System SHALL track each Vocabulary_Item with one of three statuses: chưa học (not studied), đã nhớ (remembered), chưa nhớ (not remembered)
2. THE Memory_System SHALL calculate and store: total word count, studied count, remembered count, and not-remembered count
3. WHILE presenting words for study, THE Memory_System SHALL show not-remembered words more frequently than remembered words
4. WHEN the user marks a Vocabulary_Item as "Đã nhớ" or "Chưa nhớ", THE Memory_System SHALL persist the updated status via the Storage_Manager

### Requirement 6: Dashboard

**User Story:** As a learner, I want to see my learning statistics, so that I can track my overall progress.

#### Acceptance Criteria

1. THE Dashboard SHALL display: total word count, remembered word count, words needing review count, and progress percentage
2. WHEN learning data changes, THE Dashboard SHALL update statistics in real time without page reload
3. THE Dashboard SHALL calculate progress percentage as (remembered count / total count) × 100

### Requirement 7: Local Storage persistence

**User Story:** As a learner, I want my data to persist across browser sessions, so that I don't lose my progress.

#### Acceptance Criteria

1. THE Storage_Manager SHALL save all vocabulary data and learning progress to browser Local Storage
2. WHEN the page is loaded, THE Storage_Manager SHALL restore all previously saved vocabulary data and learning progress from Local Storage
3. WHEN any data changes (vocabulary import, memorization status update), THE Storage_Manager SHALL immediately persist the change to Local Storage
4. THE App SHALL function without any backend server or network connection after initial page load

### Requirement 8: Responsive và Dark Mode

**User Story:** As a learner, I want the app to work well on both phone and desktop with a modern look, so that I can study anywhere comfortably.

#### Acceptance Criteria

1. THE App SHALL render correctly and be fully usable on screen widths from 320px to 1920px
2. THE App SHALL provide a dark mode toggle that switches between light and dark color themes
3. WHEN dark mode is toggled, THE Storage_Manager SHALL persist the user's theme preference
4. THE App SHALL display all UI labels and messages in Vietnamese

### Requirement 9: Cấu trúc code mở rộng

**User Story:** As a developer, I want the code to be well-structured, so that I can extend the app in the future.

#### Acceptance Criteria

1. THE App SHALL organize code into clearly separated components or modules by feature (import, flashcard, quiz, speech, dashboard)
2. THE App SHALL separate data logic from presentation logic

### Requirement 10: Chế độ học hàng ngày

**User Story:** As a learner, I want a daily study mode limited to a fixed number of words, so that I can build a consistent learning habit.

#### Acceptance Criteria

1. THE App SHALL provide a daily study mode that presents 10 new words per day by default
2. WHEN the user completes the daily study session, THE App SHALL display a completion message
3. THE Memory_System SHALL track which words have been assigned to each daily session

### Requirement 11: Spaced Repetition ôn tập tự động

**User Story:** As a learner, I want automatic review scheduling based on spaced repetition, so that I can retain vocabulary long-term.

#### Acceptance Criteria

1. THE Spaced_Repetition_Engine SHALL schedule review intervals for each Vocabulary_Item based on the user's recall performance
2. WHEN a user marks a word as "Đã nhớ", THE Spaced_Repetition_Engine SHALL increase the review interval for that word
3. WHEN a user marks a word as "Chưa nhớ", THE Spaced_Repetition_Engine SHALL reset the review interval to the shortest interval
4. THE Spaced_Repetition_Engine SHALL present words due for review on the Dashboard or in a dedicated review session

### Requirement 12: Xuất và nhập dữ liệu học tập

**User Story:** As a learner, I want to export and import my learning data, so that I can back up my progress or transfer it to another device.

#### Acceptance Criteria

1. WHEN the user requests data export, THE App SHALL generate a JSON file containing all vocabulary data and learning progress
2. WHEN the user uploads a previously exported JSON file, THE App SHALL restore vocabulary data and learning progress from the file
3. IF the imported file contains invalid data, THEN THE App SHALL display an error message in Vietnamese and not overwrite existing data

### Requirement 13: Dữ liệu từ vựng gốc (Pre-generated Data)

**User Story:** As a learner, I want the app to come with a large built-in vocabulary database, so that I can start studying immediately without needing to import data.

#### Acceptance Criteria

1. THE App SHALL include pre-generated JSON data files containing vocabulary extracted from PDF source files (3000.pdf and Tong-hop-1000-tu-vung-tieng-anh-A1-A2.pdf)
2. EACH Vocabulary_Item in the Pre_Generated_Data SHALL contain: English word, Vietnamese meaning, 3 simple example sentences, pronunciation (IPA), and a memory tip (mẹo ghi nhớ)
3. WHEN the app loads for the first time, THE Storage_Manager SHALL automatically load the Pre_Generated_Data into Local Storage
4. THE Pre_Generated_Data SHALL be organized by level or category for easy browsing
5. THE App SHALL NOT require any AI API calls or internet connection at runtime for the built-in vocabulary data

### Requirement 14: Tự động tạo lịch ôn tập và quiz từ data gốc

**User Story:** As a learner, I want the app to automatically generate flashcards, quizzes, and spaced repetition schedules from the built-in data, so that I can start learning immediately.

#### Acceptance Criteria

1. WHEN Pre_Generated_Data is loaded, THE Flashcard_Module SHALL automatically create flashcards for all Vocabulary_Items
2. WHEN Pre_Generated_Data is loaded, THE Quiz_Module SHALL be able to generate quizzes from the available vocabulary
3. WHEN Pre_Generated_Data is loaded, THE Spaced_Repetition_Engine SHALL automatically create an initial review schedule for all words
4. THE App SHALL organize vocabulary into study groups suitable for daily study sessions

### Requirement 15: Kiểm tra phát âm (Pronunciation Validation)

**User Story:** As a learner, I want to pronounce a vocabulary word correctly before it's marked as learned, so that I remember both its meaning and correct pronunciation.

#### Acceptance Criteria

1. THE App SHALL provide a microphone button for each Vocabulary_Item during study sessions
2. WHEN the user presses the microphone button, THE App SHALL start speech recognition using the Web Speech API (SpeechRecognition)
3. THE App SHALL compare the recognized text with the target English word (case-insensitive)
4. IF the recognized text matches the target word, THE App SHALL display "PASS - Pronunciation accepted" with a success indicator
5. IF the recognized text does not match the target word, THE App SHALL display "TRY AGAIN" along with the recognized word and the expected word
6. THE App SHALL allow the user to retry pronunciation unlimited times
7. A Vocabulary_Item SHALL only be marked as completed (đã nhớ) after the user has: viewed the meaning, listened to the pronunciation, AND successfully pronounced the word
8. THE Memory_System SHALL store for each Vocabulary_Item: number of pronunciation attempts, first successful pronunciation date, and last review date

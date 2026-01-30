
// Verification Script for Append Logic
// Logic:
// 1. Initial State: noteDetails = "Initial Note"
// 2. New Input: "Second Note"
// 3. Expected Result: "Initial Note\n\n[YYYY-MM-DD HH:mm Admin]\nSecond Note\n"

function verifyAppendLogic() {
    console.log('--- TESTING APPEND LOGIC ---');

    // Scenario 1: Existing Note exists
    let currentDetails = "기존에 작성된 비밀노트입니다.";
    const newNote = "추가된 비밀노트입니다.";
    const author = "김강사";
    const timestamp = "2024-01-30 14:00:00"; // Mock timestamp

    console.log(`[Before] ${currentDetails}`);

    // Logic from InstructorRecordingPage.tsx
    let finalSecretDetails = currentDetails;
    if (newNote.trim().length > 0) {
        const appendLog = `\n[${timestamp} ${author}]\n${newNote.trim()}\n`;
        if (finalSecretDetails) {
            finalSecretDetails += `\n${appendLog}`;
        } else {
            finalSecretDetails = appendLog;
        }
    }

    console.log(`[After] \n${finalSecretDetails}`);

    if (finalSecretDetails.includes(currentDetails) && finalSecretDetails.includes(newNote) && finalSecretDetails.includes(timestamp)) {
        console.log('✅ PASS: Logic correctly appends new note with timestamp.');
    } else {
        console.error('❌ FAIL: Logic failed to append correctly.');
    }

    // Scenario 2: Empty Start
    console.log('\n--- SCENARIO 2: Empty Start ---');
    currentDetails = "";
    finalSecretDetails = currentDetails;

    if (newNote.trim().length > 0) {
        const appendLog = `\n[${timestamp} ${author}]\n${newNote.trim()}\n`;
        if (finalSecretDetails) {
            finalSecretDetails += `\n${appendLog}`;
        } else {
            finalSecretDetails = appendLog;
        }
    }
    console.log(`[After Empty] \n${finalSecretDetails}`);
    if (finalSecretDetails.includes(newNote) && finalSecretDetails.includes(timestamp)) {
        console.log('✅ PASS: Logic correctly handles first note.');
    } else {
        console.error('❌ FAIL: Logic failed for first note.');
    }
}

verifyAppendLogic();

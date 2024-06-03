import * as readline from 'readline';

export async function validateInput() {
    function waitForInput(question: string): Promise<string> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    
        return new Promise<string>((resolve) => {
            rl.question(question, (input) => {
                resolve(input);
                rl.close();
            });
        });
    }
    const userInput = await waitForInput('Enter Positive Integer to Continue: ');

    const number: number = parseInt(userInput);

    if (isNaN(number)) {
        console.log('Invalid input. Please enter a valid number.');
        return process.exit(1)
    }
    if (number == 0) {
        return process.exit(1)
    }
    console.log("Cool, Going forward with the current deployment process");
}
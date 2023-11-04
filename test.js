

for (let A = 1; A < 100; A++) {
    for (let B = 1; B < 100; B++) {
        for (let C = 1; C < 100; C++) {
            let D = A/(B+C) + B/(A+C) + C/(A+B);
            console.log(`${D}`);
        }
    }
}

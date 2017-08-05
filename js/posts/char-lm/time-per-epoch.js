printEpochTimes('batch_size', [1, 10, 20, 50, 100, 200, 500, 2000]);
printEpochTimes('num_timesteps', [40, 80, 120, 160]);
printEpochTimes('south_park', ['2017-01-18T10-32-14','num_timesteps/200/2017-01-18T13-56-50']);
printEpochTimes('num_neurons', ['512', '1024']);

function printEpochTimes(parameter, values) {
    values.map(value => {
        // get the data and push the trainstates
        return $.getJSON(`assets/posts/char-lm/data/${parameter}/${value}/model.trainstate.json`).then(trainstate => {
            let log = PostUtil.getPreprocessedLog(trainstate.log);

            let maxEpoch = Math.max(...log.epochs.values());
            if (maxEpoch == 1) maxEpoch = 2;

            let allowedSteps = Array.from(log.epochs.keys())
                .filter(step => log.epochs.get(step) < maxEpoch);
            let maxStep = Math.max(...allowedSteps);

            // Filter the steps to exclude the last (possibly incomplete) epoch
            let secondsSteps = Array.from(log.secondsSinceStart.keys())
                .filter(step => step <= maxStep);
            let totalSeconds = log.secondsSinceStart.get(Math.max(...secondsSteps));

            console.log(value, totalSeconds / ((maxEpoch - 1) * 60) + ' minutes');
        });
    });
}
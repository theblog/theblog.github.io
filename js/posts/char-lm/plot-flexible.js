const runGroupValues = {
    batch_size: ['1', '10', '20', '50', '100', '200', '500', '2000'],
    learning_rate_512: ['0.05', '0.01', '0.005', '0.001'],
    num_timesteps: ['40', '80', '120', '160'],
    learning_rate_1024: ['0.01', '0.005', '0.001'],
    num_neurons: ['512', '1024'],
    output_keep_prob: ['0.3', '0.5', '0.8'],
    num_layers: ['2', '3', '4'],
    reset_state_interval_tokens: ['never', 'always', '320', '1120', '2080'],
    wiki: ['small', 'medium', 'medium-with-reset']
};

const RUN_GROUP_COLORS = {
    batch_size: {
        '1': '#FFCDD2',
        '10': '#E57373',
        '20': '#C8E6C9',
        '50': '#66BB6A',
        '100': '#2E7D32',
        '200': '#123317',
        '500': '#FFECB3',
        '2000': '#FFC107'
    },
    learning_rate_512: {
        '0.05': PostUtil.CHART_COLORS_BLUE[0],
        '0.01': PostUtil.CHART_COLORS_BLUE[1],
        '0.005': PostUtil.CHART_COLORS_BLUE[3],
        '0.001': PostUtil.CHART_COLORS_BLUE[4]
    },
    num_timesteps : {
        '40': PostUtil.CHART_COLORS_BLUE[0],
        '80': PostUtil.CHART_COLORS_BLUE[1],
        '120': PostUtil.CHART_COLORS_BLUE[3],
        '160': PostUtil.CHART_COLORS_BLUE[4]
    },
    learning_rate_1024: {
        '0.01': PostUtil.CHART_COLORS_BLUE[0],
        '0.005': PostUtil.CHART_COLORS_BLUE[2],
        '0.001': PostUtil.CHART_COLORS_BLUE[4]
    },
    num_neurons: {
        '512': PostUtil.CHART_COLORS_BLUE[1],
        '1024': PostUtil.CHART_COLORS_BLUE[4]
    },
    output_keep_prob: {
        '0.3': PostUtil.CHART_COLORS_BLUE[0],
        '0.5': PostUtil.CHART_COLORS_BLUE[2],
        '0.8': PostUtil.CHART_COLORS_BLUE[4]
    },
    num_layers: {
        '2': PostUtil.CHART_COLORS_BLUE[0],
        '3': PostUtil.CHART_COLORS_BLUE[2],
        '4': PostUtil.CHART_COLORS_BLUE[4]
    },
    reset_state_interval_tokens: {
        'always': PostUtil.CHART_COLORS_BLUE[0],
        '320': PostUtil.CHART_COLORS_BLUE[1],
        '1120': PostUtil.CHART_COLORS_BLUE[2],
        '2080': PostUtil.CHART_COLORS_BLUE[3],
        'never': PostUtil.CHART_COLORS_BLUE[4]
    }
};

const AXIS_LABELS = {
    lossesValid: 'Validation Perplexity',
    lossesTrain: 'Training Perplexity',
    minutesSinceStart: 'Training Time [min]',
    epochs: 'Epoch'
};

let Y_AXIS_RANGE_SLIDER = $('#y-axis-range');
let chartExport = null;

window.onContentReadyCallbacks.push(function () {
    Chart.defaults.global.maintainAspectRatio = false;
    Chart.defaults.global.elements.line.fill = false;
    Chart.defaults.global.elements.line.tension = 0;
    Chart.defaults.global.elements.point.radius = 0;

    Y_AXIS_RANGE_SLIDER = $('#y-axis-range');
    chartExport = null;

    // Initialize the range slider
    Y_AXIS_RANGE_SLIDER.ionRangeSlider({
        type: 'double',
        min: 2,
        max: 24,
        onFinish: () => plot()
    });
});

function exportChart() {
    console.log(chartExport);
}

function plot(resetYRange = false) {
    const runGroupName = $('#run-group-dropdown').find('.dropdown-toggle').val();
    getLogs(runGroupName).then(logs => plotLogs(logs, runGroupName, resetYRange));
}

function getLogs(runGroup) {
    const values = runGroupValues[runGroup];
    // Store the data locally so that we don't interfere with the global logs until all data are
    // loaded.
    let data = {};
    return Promise.all(values.map(value => {
        // get the data and push the trainstates
        return $.getJSON(`assets/posts/char-lm/data/${runGroup}/${value}/model.trainstate.json`)
            .then(trainstate => {
                data[value] = PostUtil.getPreprocessedLog(trainstate.log);
            });
    })).then(() => {
        return data;
    });
}

function getEquidistantPoints(data, numPoints) {
    if (data.length <= numPoints) return data;

    // Get the range
    const {minX, maxX} = data.reduce((reduced, point) => {
        if (point.x < reduced.minX) reduced.minX = point.x;
        if (point.x > reduced.maxX) reduced.maxX = point.x;
        return reduced;
    }, {minX: data[0].x, maxX: data[0].x});

    // Sample the points
    let points = [];
    const stepSize = (maxX - minX) / (numPoints - 1);
    data.sort((a, b) => a.x - b.x).forEach(point => {
        if (point.x >= minX + points.length * stepSize - Math.pow(10, -8)) {
            points.push(point);
        }
    });
    return points;
}

function getData(log, xKey, yKey) {
    let dataMap = PostUtil.replaceClosestKeys(log[yKey], log[xKey]);
    let data = [];
    dataMap.forEach((value, key) => {
        data.push({x: key, y: value});
    });
    return data;
}

function resetSlider(yMin, yMax) {
    const decimals = yMax - yMin > 2 ? 0 : 1;
    const slider = $('#y-axis-range').data('ionRangeSlider');
    const decimalShift = Math.pow(10, decimals);
    yMin = (Math.floor(yMin * decimalShift) / decimalShift).toFixed(decimals);
    yMax = (Math.ceil(yMax * decimalShift) / decimalShift).toFixed(decimals);
    slider.update({
        min: yMin,
        max: yMax,
        from: yMin,
        to: yMax
    });
}

function plotLogs(logs, runGroupName, resetYRange = false) {
    const xKey = $('#x-axis-dropdown').find('.dropdown-toggle').val();
    const yKey = $('#y-axis-dropdown').find('.dropdown-toggle').val();

    // Filter the data points with the y-axis range slider
    let slider = Y_AXIS_RANGE_SLIDER.data('ionRangeSlider');
    // Record the data's min and max to update the slider limits
    let yRange = {min: null, max: null};

    const runValues = Object.keys(logs);
    const datasets = runValues.map((value, index) => {
        let data = getData(logs[value], xKey, yKey);

        data = data.filter(point => {
            // Ignore and filter outliers completely
            if (point.y > 30 || point.y < 0.01) return false;

            if (yRange.min == null || point.y < yRange.min) yRange.min = point.y;
            if (yRange.max == null || point.y > yRange.max) yRange.max = point.y;
            // Return the actual filter condition
            return resetYRange || (slider.result.from <= point.y && point.y <= slider.result.to);
        });
        data = getEquidistantPoints(data, 30);

        return {
            label: value,
            data: data,
            borderColor: RUN_GROUP_COLORS[runGroupName][value],
            backgroundColor: RUN_GROUP_COLORS[runGroupName][value]
        };
    });

    if (resetYRange) resetSlider(yRange.min, yRange.max);

    PostUtil.clearChart('flexible-chart');
    const chartParams = {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            scales: {
                xAxes: [{
                    type: 'linear',
                    position: 'bottom',
                    scaleLabel: {
                        display: true,
                        labelString: AXIS_LABELS[xKey]
                    }
                }],
                yAxes: [{
                    type: 'logarithmic',
                    ticks: {
                        min: resetYRange ? yRange.min : slider.result.from,
                        max: resetYRange ? yRange.max : slider.result.to,
                        callback: value => value.toFixed(2)
                    },
                    scaleLabel: {
                        display: true,
                        labelString: AXIS_LABELS[yKey]
                    }
                }]
            }
        }
    };
    // chartParams will be modified by chartjs, so we need to copy them
    chartExport = JSON.stringify(chartParams);
    new Chart('flexible-chart', chartParams);
}
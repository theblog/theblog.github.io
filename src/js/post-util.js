class PostUtil {
    static generateUUID() {
        let d = new Date().getTime();
        if (window.performance && typeof window.performance.now === "function") {
            d += performance.now(); //use high-precision timer if available
        }
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid;
    }

    static getRandomCharacter() {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        return alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    static getRandomSentence(length) {
        let text = "";
        for (let i = 0; i < length; i++) {
            text += PostUtil.getRandomCharacter();
            // Append a space every 6 characters on average
            if (Math.random() < 0.1667) {
                text += ' ';
            }
        }
        return text;
    }

    static objectValues(obj) {
        return Object.keys(obj).map(key => obj[key]);
    }

    static replaceClosestKeys(map, dictionary) {
        // Creates a new Map with the values of dictionary as keys. Keys of obj and dictionary
        // must be integers.
        let result = new Map();
        let keys = Array.from(dictionary.keys());
        map.forEach((value, key) => {
            let closestKey = Math.min(...keys.filter(k => k >= key));
            result.set(dictionary.get(closestKey), value);
        });
        return result;
    }

    static getPreprocessedLog(log) {
        // Preprocess the log of a trainstate
        let result = {};

        // Convert the step keys to maps with integer keys
        Object.keys(log).forEach(seriesKey => {
            result[seriesKey] = PostUtil.parseSeriesToIntMap(log[seriesKey]);
        });

        // Exponentiate the losses to perplexities
        ['lossesTrain', 'lossesValid'].forEach(seriesKey => {
            let series = result[seriesKey];
            for (let entryKey of series.keys()) {
                series.set(entryKey, Math.pow(2, series.get(entryKey)));
            }
        });

        // Split up the epochs into floating point epochs
        const epochRanges = {};
        result.epochs.forEach((epoch, step) => {
            if (!epochRanges[epoch]) {
                epochRanges[epoch] = {min: step, max: step};
            } else if (step < epochRanges[epoch].min) {
                epochRanges[epoch].min = step;
            } else if (step > epochRanges[epoch].max) {
                epochRanges[epoch].max = step;
            }
        });
        result.epochs.forEach((epoch, step) => {
            let min = epochRanges[epoch].min;
            let max = epochRanges[epoch].max;
            let progress = max != min ? (step - min) / (max - min) : 0;
            result.epochs.set(step, epoch + progress);
        });


        // Create a new series secondsSinceStart out of the intervalSeconds
        result.secondsSinceStart = new Map();
        result.minutesSinceStart = new Map();
        let currentSeconds = 0;
        Array.from(result.intervalSeconds.keys())
            .sort((a, b) => a - b)
            .forEach(step => {
                currentSeconds += result.intervalSeconds.get(step);
                result.secondsSinceStart.set(step, currentSeconds);
                result.minutesSinceStart.set(step, currentSeconds/60);
            });
        return result;
    }

    static getYRange(datasets) {
        let range = {min: null, max: null};
        datasets.forEach(dataset => {
            dataset.data.forEach(point => {
                range.min = range.min != null ? Math.min(range.min, point.y) : point.y;
                range.max = range.max != null ? Math.max(range.max, point.y) : point.y;
            });
        });
        return range;
    }

    static parseSeriesToIntMap(series) {
        let parsed = new Map();
        Object.keys(series).forEach(key => {
            parsed.set(parseInt(key), series[key]);
        });
        return parsed;
    }

    static placeCaretAtEnd(el) {
        // See http://stackoverflow.com/questions/4233265/contenteditable-set-caret-at-the-end-of-the-text-cross-browser
        el.focus();
        if (typeof window.getSelection != "undefined"
            && typeof document.createRange != "undefined") {
            var range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (typeof document.body.createTextRange != "undefined") {
            var textRange = document.body.createTextRange();
            textRange.moveToElementText(el);
            textRange.collapse(false);
            textRange.select();
        }
    }

    static clearChart(id) {
        const oldCanvas = $(`#${id}`);
        // ChartJS modifies the canvas width and height attributes, so we need to store them in data
        const width = oldCanvas.data('width');
        const height = oldCanvas.data('height');
        const classes = oldCanvas.attr('class');
        const newCanvas = $('<canvas>')
            .data('width', width).data('height', height)
            .attr('width', width).attr('height', height)
            .attr('class', classes).attr('id', id);
        oldCanvas.parent().empty().append(newCanvas);
    }
}

PostUtil.CHART_COLORS_DIVERSE = [
    '#fe819d',
    '#2196F3',
    '#ffce56',
    '#9575CD',
    '#e0846b',
    '#5f8ca1',
    '#626a61',
    '#A9A9A9',
    '#C5CAE9'];
PostUtil.CHART_COLORS_BLUE = [
    '#BBDEFB',
    '#64B5F6',
    '#2196F3',
    '#1565C0',
    '#133270',
    '#172237'];
PostUtil.CHART_COLORS_INDIGO = [
    '#C5CAE9',
    '#7986CB',
    '#3F51B5',
    '#283593',
    '#1e2868',
    '#121424'];
PostUtil.CHART_COLORS_DEEP_PURPLE = [
    '#D1C4E9',
    '#9575CD',
    '#673AB7',
    '#4527A0',
    '#2e185d',
    '#121424'];
PostUtil.CHART_COLORS_RED = [
    '#FFCDD2',
    '#E57373',
    '#F44336',
    '#C62828',
    '#721414',
    '#340707'];
PostUtil.CHART_COLORS_GREEN = [
    '#C8E6C9',
    '#81C784',
    '#4CAF50',
    '#2E7D32',
    '#123317',
    '#0a1a0d'];
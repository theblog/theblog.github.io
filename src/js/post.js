processPageElements();

function processPageElements() {
    // Wrap each chart with siblings in a div to be able to safely clear the chart.js iframe
    // junk
    $('canvas.chart').filter((index, element) => $(element).siblings()).wrap('<div></div>');

    // Apply the transforms
    colorCellsByLogValue();
}

function colorCellsByLogValue() {
    $('[data-transform="color-cells-by-log-value"]').each((index, element) => {
        const cells = $(element).find('td');

        // Determine the min and max log values
        let min = null;
        let max = null;
        cells.each((index, cell) => {
            cell = $(cell);
            let val = parseFloat(cell.html());
            if (!isNaN(val)) {
                val = Math.log(val);
                min = min ? Math.min(min, val) : val;
                max = max ? Math.max(max, val) : val;
            }
        });

        // Color each cell based on its value
        cells.each((index, cell) => {
            cell = $(cell);
            let val = parseFloat(cell.html());
            if (!isNaN(val)) {
                val = Math.log(val);
                let percentage = (val - min) / (max - min);
                cell.css('background-color', 'rgba(229,115,115,' + percentage + ')');
            }
        });
    });
}
processPageElements();

function processPageElements() {
    // Wrap tables to make them responsive.
    $('table').filter((index, element) => !($(element).parent().hasClass('table-container')))
        .wrap('<div class="table-container"></div>');

    // Wrap each chart with siblings in a div to be able to safely clear the chart.js iframe
    // junk
    $('canvas.chart').filter((index, element) => $(element).siblings()).wrap('<div></div>');

    // Bring the bootstrap dropdowns to life
    $('.dropdown-menu li a').off('click').click(function () {
        selectDropdownItem($(this));
    });

    // Activate the show more toggles
    $('.show-more').off('click').click($event => {
        // Expand / hide additional information
        const button = $($event.target);
        const target = $('#' + button.data('target-id'));
        const showText = button.data('show-text') || 'Show more';
        const hideText = button.data('hide-text') || 'Show less';
        // If the target is visible, it won't be after this block.
        button.html(target.is(':visible') ? showText : hideText);
        target.slideToggle();
    });

    // Apply the transforms
    colorCellsByLogValue();

    runHighlighting();
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
                let percentage = (val-min) / (max-min);
                cell.css('background-color', 'rgba(229,115,115,'+percentage+')');
            }
        });
    });
}

function runHighlighting() {
    // MathJax.Hub.Queue(["Typeset", MathJax.Hub]); // Run Mathjax

    // Run hljs
    $('pre code').each(function (i, block) {
        hljs.highlightBlock(block);
    });
}
{% load i18n %}
{% load inventree_extras %}

/* globals
    addClearCallback,
    buildStatusDisplay,
    clearEvents,
    constructExpandCollapseButtons,
    constructField,
    constructForm,
    constructOrderTableButtons,
    endDate,
    formatDecimal,
    FullCalendar,
    getFormFieldValue,
    getTableData,
    handleFormErrors,
    handleFormSuccess,
    imageHoverIcon,
    initializeRelatedField,
    inventreeGet,
    inventreeLoad,
    inventreePut,
    launchModalForm,
    linkButtonsToSelection,
    loadTableFilters,
    makeDeleteButton,
    makeEditButton,
    makeRemoveButton,
    makeIconBadge,
    makeIconButton,
    makePartIcons,
    makeProgressBar,
    orderParts,
    renderDate,
    renderLink,
    setupFilterList,
    shortenString,
    showAlertDialog,
    showApiError,
    startDate,
    stockStatusDisplay,
    showApiErrors,
    thumbnailImage,
    updateFieldValue,
    wrapButtons,
    yesNoLabel,
*/

/* exported
    allocateStockToBuild,
    autoAllocateStockToBuild,
    cancelBuildOrder,
    completeBuildOrder,
    createBuildOutput,
    duplicateBuildOrder,
    editBuildOrder,
    loadAllocationTable,
    loadBuildLineTable,
    loadBuildOrderAllocationTable,
    loadBuildOutputAllocationTable,
    loadBuildOutputTable,
    loadBuildTable,
*/


function buildFormFields() {
    return {
        reference: {
            icon: 'fa-hashtag',
        },
        part: {
            filters: {
                assembly: true,
                virtual: false,
            }
        },
        title: {},
        quantity: {},
        priority: {},
        parent: {
            filters: {
                part_detail: true,
            }
        },
        sales_order: {
            icon: 'fa-truck',
        },
        batch: {},
        target_date: {
            icon: 'fa-calendar-alt',
        },
        take_from: {
            icon: 'fa-sitemap',
            filters: {
                structural: false,
            }
        },
        destination: {
            icon: 'fa-sitemap',
            filters: {
                structural: false,
            }
        },
        link: {
            icon: 'fa-link',
        },
        issued_by: {
            icon: 'fa-user',
        },
        responsible: {
            icon: 'fa-users',
        },
    };
}

/*
 * Edit an existing BuildOrder via the API
 */
function editBuildOrder(pk) {

    var fields = buildFormFields();

    constructForm(`{% url "api-build-list" %}${pk}/`, {
        fields: fields,
        reload: true,
        title: '{% trans "Edit Build Order" %}',
    });
}


/*
 * Create a new build order via an API form
 */
function newBuildOrder(options={}) {
    /* Launch modal form to create a new BuildOrder.
     */

    var fields = buildFormFields();

    // Specify the target part
    if (options.part) {
        fields.part.value = options.part;
    }

    // Specify the desired quantity
    if (options.quantity) {
        fields.quantity.value = options.quantity;
    }

    // Specify the parent build order
    if (options.parent) {
        fields.parent.value = options.parent;
    }

    // Specify a parent sales order
    if (options.sales_order) {
        fields.sales_order.value = options.sales_order;
    }

    if (options.data) {
        delete options.data.pk;
    }

    constructForm(`/api/build/`, {
        fields: fields,
        data: options.data,
        follow: true,
        method: 'POST',
        title: '{% trans "Create Build Order" %}',
        onSuccess: options.onSuccess,
    });
}


/*
 * Duplicate an existing build order.
 */
function duplicateBuildOrder(build_id, options={}) {

    inventreeGet(`{% url "api-build-list" %}${build_id}/`, {}, {
        success: function(data) {
            // Clear out data we do not want to be duplicated
            delete data['pk'];
            delete data['issued_by'];
            delete data['reference'];

            options.data = data;
            newBuildOrder(options);
        }
    });
}



/* Construct a form to cancel a build order */
function cancelBuildOrder(build_id, options={}) {

    constructForm(
        `{% url "api-build-list" %}${build_id}/cancel/`,
        {
            method: 'POST',
            title: '{% trans "Cancel Build Order" %}',
            confirm: true,
            fields: {
                remove_allocated_stock: {},
                remove_incomplete_outputs: {},
            },
            preFormContent: function(opts) {
                var html = `
                <div class='alert alert-block alert-info'>
                    {% trans "Are you sure you wish to cancel this build?" %}
                </div>`;

                if (opts.context.has_allocated_stock) {
                    html += `
                    <div class='alert alert-block alert-warning'>
                        {% trans "Stock items have been allocated to this build order" %}
                    </div>`;
                }

                if (opts.context.incomplete_outputs) {
                    html += `
                    <div class='alert alert-block alert-warning'>
                        {% trans "There are incomplete outputs remaining for this build order" %}
                    </div>`;
                }

                return html;
            },
            onSuccess: function(response) {
                handleFormSuccess(response, options);
            }
        }
    );
}


/* Construct a form to "complete" (finish) a build order */
function completeBuildOrder(build_id, options={}) {

    constructForm(`{% url "api-build-list" %}${build_id}/finish/`, {
        fieldsFunction: function(opts) {
            var ctx = opts.context || {};

            var fields = {
                accept_unallocated: {},
                accept_overallocated: {},
                accept_incomplete: {},
            };

            // Hide "accept overallocated" field if the build is *not* overallocated
            if (!ctx.overallocated) {
                delete fields.accept_overallocated;
            }

            // Hide "accept incomplete" field if the build has been completed
            if (!ctx.remaining || ctx.remaining == 0) {
                delete fields.accept_incomplete;
            }

            // Hide "accept unallocated" field if the build is fully allocated
            if (ctx.allocated) {
                delete fields.accept_unallocated;
            }

            return fields;
        },
        preFormContent: function(opts) {
            var ctx = opts.context || {};

            var html = '';

            if (ctx.allocated && ctx.remaining == 0 && ctx.incomplete == 0) {
                html += `
                <div class='alert alert-block alert-success'>
                {% trans "Build order is ready to be completed" %}'
                </div>`;
            } else {

                if (ctx.incomplete > 0) {
                    html += `
                    <div class='alert alert-block alert-danger'>
                    <strong>{% trans "Build order has incomplete outputs" %}</strong><br>
                    {% trans "This build order cannot be completed as there are incomplete outputs" %}
                    </div>`;
                } else {
                    html += `
                    <div class='alert alert-block alert-danger'>
                    <strong>{% trans "Build Order is incomplete" %}</strong>
                    </div>
                    `;
                }

                if (!ctx.allocated) {
                    html += `<div class='alert alert-block alert-warning'>{% trans "Required stock has not been fully allocated" %}</div>`;
                }

                if (ctx.remaining > 0) {
                    html += `<div class='alert alert-block alert-warning'>{% trans "Required build quantity has not been completed" %}</div>`;
                }
            }

            return html;
        },
        reload: true,
        confirm: true,
        title: '{% trans "Complete Build Order" %}',
        method: 'POST',
    });
}


/*
 * Construct a new build output against the provided build
 */
function createBuildOutput(build_id, options) {

    // Request build order information from the server
    inventreeGet(
        `{% url "api-build-list" %}${build_id}/`,
        {},
        {
            success: function(build) {

                var html = '';

                var trackable = build.part_detail.trackable;
                var remaining = Math.max(0, build.quantity - build.completed);

                var fields = {
                    quantity: {
                        value: remaining,
                    },
                    serial_numbers: {
                        hidden: !trackable,
                        required: options.trackable_parts || trackable,
                    },
                    batch_code: {},
                    auto_allocate: {
                        hidden: !trackable,
                    },
                };

                // Work out the next available serial numbers
                inventreeGet(`{% url "api-part-list" %}${build.part}/serial-numbers/`, {}, {
                    success: function(data) {
                        if (data.next) {
                            fields.serial_numbers.placeholder = `{% trans "Next available serial number" %}: ${data.next}`;
                        } else if (data.latest) {
                            fields.serial_numbers.placeholder = `{% trans "Latest serial number" %}: ${data.latest}`;
                        }
                    },
                    async: false,
                });

                if (options.trackable_parts) {
                    html += `
                    <div class='alert alert-block alert-info'>
                        {% trans "The Bill of Materials contains trackable parts" %}.<br>
                        {% trans "Build outputs must be generated individually" %}.
                    </div>
                    `;
                }

                if (trackable) {
                    html += `
                    <div class='alert alert-block alert-info'>
                        {% trans "Trackable parts can have serial numbers specified" %}<br>
                        {% trans "Enter serial numbers to generate multiple single build outputs" %}
                    </div>
                    `;
                }

                constructForm(`{% url "api-build-list" %}${build_id}/create-output/`, {
                    method: 'POST',
                    title: '{% trans "Create Build Output" %}',
                    confirm: true,
                    fields: fields,
                    preFormContent: html,
                    onSuccess: function(response) {
                        location.reload();
                    },
                });

            }
        }
    );

}


/*
 * Construct a set of output buttons for a particular build output
 */
function makeBuildOutputButtons(output_id, build_info, options={}) {

    var html = '';

    // Tracked parts? Must be individually allocated
    if (options.has_tracked_lines) {

        // Add a button to allocate stock against this build output
        html += makeIconButton(
            'fa-sign-in-alt icon-blue',
            'button-output-allocate',
            output_id,
            '{% trans "Allocate stock items to this build output" %}',
        );

        // Add a button to deallocate stock from this build output
        html += makeIconButton(
            'fa-minus-circle icon-red',
            'button-output-deallocate',
            output_id,
            '{% trans "Deallocate stock from build output" %}',
        );
    }

    // Add a button to "complete" this build output
    html += makeIconButton(
        'fa-check-circle icon-green',
        'button-output-complete',
        output_id,
        '{% trans "Complete build output" %}',
    );

    // Add a button to "scrap" the build output
    html += makeIconButton(
        'fa-times-circle icon-red',
        'button-output-scrap',
        output_id,
        '{% trans "Scrap build output" %}',
    );

    // Add a button to "remove" this build output
    html += makeDeleteButton(
        'button-output-remove',
        output_id,
        '{% trans "Delete build output" %}',
    );

    return wrapButtons(html);
}


/*
 * Deallocate stock against a particular build order
 *
 * Options:
 * - output: pk value for a stock item "build output"
 * - bom_item: pk value for a particular BOMItem (build item)
 */
function deallocateStock(build_id, options={}) {

    var url = `{% url "api-build-list" %}${build_id}/unallocate/`;

    var html = `
    <div class='alert alert-block alert-warning'>
    {% trans "Are you sure you wish to deallocate the selected stock items from this build?" %}
    </dvi>
    `;

    constructForm(url, {
        method: 'POST',
        confirm: true,
        preFormContent: html,
        fields: {
            output: {
                hidden: true,
                value: options.output,
            },
            build_line: {
                hidden: true,
                value: options.build_line,
            },
        },
        title: '{% trans "Deallocate Stock Items" %}',
        onSuccess: function(response, opts) {
            if (options.onSuccess) {
                options.onSuccess(response, opts);
            } else if (options.table) {
                // Reload the parent table
                $(options.table).bootstrapTable('refresh');
            }
        }
    });
}


/*
 * Helper function to render a single build output in a modal form
 */
function renderBuildOutput(output, options={}) {
    let pk = output.pk;

    let output_html = imageHoverIcon(output.part_detail.thumbnail);

    if (output.quantity == 1 && output.serial) {
        output_html += `{% trans "Serial Number" %}: ${output.serial}`;
    } else {
        output_html += `{% trans "Quantity" %}: ${output.quantity}`;
        if (output.part_detail && output.part_detail.units) {
            output_html += ` ${output.part_detail.units}  `;
        }
    }

    let buttons = `<div class='btn-group float-right' role='group'>`;

    buttons += makeRemoveButton('button-row-remove', pk, '{% trans "Remove row" %}');

    buttons += '</div>';

    let field = constructField(
        `outputs_output_${pk}`,
        {
            type: 'raw',
            html: output_html,
        },
        {
            hideLabels: true,
        }
    );

    let quantity_field = '';

    if (options.adjust_quantity) {
        quantity_field = constructField(
            `outputs_quantity_${pk}`,
            {
                type: 'decimal',
                value: output.quantity,
                min_value: 0,
                max_value: output.quantity,
                required: true,
            },
            {
                hideLabels: true,
            }
        );

        quantity_field = `<td>${quantity_field}</td>`;
    }

    let html = `
    <tr id='output_row_${pk}'>
        <td>${field}</td>
        <td>${output.part_detail.full_name}</td>
        ${quantity_field}
        <td>${buttons}</td>
    </tr>`;

    return html;
}


/**
 * Launch a modal form to complete selected build outputs
 */
function completeBuildOutputs(build_id, outputs, options={}) {

    if (outputs.length == 0) {
        showAlertDialog(
            '{% trans "Select Build Outputs" %}',
            '{% trans "At least one build output must be selected" %}',
        );
        return;
    }

    // Construct table entries
    var table_entries = '';

    outputs.forEach(function(output) {
        table_entries += renderBuildOutput(output);
    });

    var html = `
    <div class='alert alert-block alert-success'>
    {% trans "Selected build outputs will be marked as complete" %}
    </div>
    <table class='table table-striped table-condensed' id='build-complete-table'>
        <thead>
            <th colspan='2'>{% trans "Output" %}</th>
            <th><!-- Actions --></th>
        </thead>
        <tbody>
            ${table_entries}
        </tbody>
    </table>`;

    constructForm(`{% url "api-build-list" %}${build_id}/complete/`, {
        method: 'POST',
        preFormContent: html,
        fields: {
            status: {},
            location: {
                filters: {
                    structural: false,
                },
            },
            notes: {
                icon: 'fa-sticky-note',
            },
            accept_incomplete_allocation: {},
        },
        confirm: true,
        title: '{% trans "Complete Build Outputs" %}',
        afterRender: function(fields, opts) {
            // Setup callbacks to remove outputs
            $(opts.modal).find('.button-row-remove').click(function() {
                var pk = $(this).attr('pk');

                $(opts.modal).find(`#output_row_${pk}`).remove();
            });
        },
        onSubmit: function(fields, opts) {

            // Extract data elements from the form
            var data = {
                outputs: [],
                status: getFormFieldValue('status', {}, opts),
                location: getFormFieldValue('location', {}, opts),
                notes: getFormFieldValue('notes', {}, opts),
                accept_incomplete_allocation: getFormFieldValue('accept_incomplete_allocation', {type: 'boolean'}, opts),
            };

            var output_pk_values = [];

            outputs.forEach(function(output) {
                var pk = output.pk;

                var row = $(opts.modal).find(`#output_row_${pk}`);

                if (row.exists()) {
                    data.outputs.push({
                        output: pk,
                    });
                    output_pk_values.push(pk);
                }
            });

            // Provide list of nested values
            opts.nested = {
                'outputs': output_pk_values,
            };

            inventreePut(
                opts.url,
                data,
                {
                    method: 'POST',
                    success: function(response) {
                        // Hide the modal
                        $(opts.modal).modal('hide');

                        if (options.success) {
                            options.success(response);
                        }
                    },
                    error: function(xhr) {
                        switch (xhr.status) {
                        case 400:
                            handleFormErrors(xhr.responseJSON, fields, opts);
                            break;
                        default:
                            $(opts.modal).modal('hide');
                            showApiError(xhr, opts.url);
                            break;
                        }
                    }
                }
            );
        }
    });
}



/*
 * Launch a modal form to scrap selected build outputs.
 * Scrapped outputs are marked as "complete", but with the "rejected" code
 * These outputs are not included in build completion calculations.
 */
function scrapBuildOutputs(build_id, outputs, options={}) {

    if (outputs.length == 0) {
        showAlertDialog(
            '{% trans "Select Build Outputs" %}',
            '{% trans "At least one build output must be selected" %}',
        );
        return;
    }

    let table_entries = '';

    outputs.forEach(function(output) {
        table_entries += renderBuildOutput(output, {
            adjust_quantity: true,
        });
    });

    var html = `
    <div class='alert alert-block alert-danger'>
    {% trans "Selected build outputs will be marked as scrapped" %}
    <ul>
        <li>{% trans "Scrapped output are marked as rejected" %}</li>
        <li>{% trans "Allocated stock items will no longer be available" %}</li>
        <li>{% trans "The completion status of the build order will not be adjusted" %}</li>
    </ul>
    </div>
    <table class='table table-striped table-condensed' id='build-scrap-table'>
        <thead>
            <th colspan='2'>{% trans "Output" %}</th>
            <th>{% trans "Quantity" %}</th>
            <th><!-- Actions --></th>
        </thead>
        <tbody>
            ${table_entries}
        </tbody>
    </table>`;

    constructForm(`{% url "api-build-list" %}${build_id}/scrap-outputs/`, {
        method: 'POST',
        preFormContent: html,
        fields: {
            location: {
                filters: {
                    structural: false,
                }
            },
            notes: {},
            discard_allocations: {},
        },
        confirm: true,
        title: '{% trans "Scrap Build Outputs" %}',
        afterRender: function(fields, opts) {
            // Setup callbacks to remove outputs
            $(opts.modal).find('.button-row-remove').click(function() {
                let pk = $(this).attr('pk');
                $(opts.modal).find(`#output_row_${pk}`).remove();
            });
        },
        onSubmit: function(fields, opts) {
            let data = {
                outputs: [],
                location: getFormFieldValue('location', {}, opts),
                notes: getFormFieldValue('notes', {}, opts),
                discard_allocations: getFormFieldValue('discard_allocations', {type: 'boolean'}, opts),
            };

            let output_pk_values = [];

            outputs.forEach(function(output) {
                let pk = output.pk;
                let row = $(opts.modal).find(`#output_row_${pk}`);
                let quantity = getFormFieldValue(`outputs_quantity_${pk}`, {}, opts);

                if (row.exists()) {
                    data.outputs.push({
                        output: pk,
                        quantity: quantity,
                    });

                    output_pk_values.push(pk);
                }
            });

            opts.nested = {
                'outputs': output_pk_values,
            };

            inventreePut(
                opts.url,
                data,
                {
                    method: 'POST',
                    success: function(response) {
                        $(opts.modal).modal('hide');

                        if (options.success) {
                            options.success(response);
                        }
                    },
                    error: function(xhr) {
                        switch (xhr.status) {
                        case 400:
                            handleFormErrors(xhr.responseJSON, fields, opts);
                            break;
                        default:
                            $(opts.modal).modal('hide');
                            showApiError(xhr, opts.url);
                            break;
                        }
                    }
                }
            );
        }
    });
}


/**
 * Launch a modal form to delete selected build outputs.
 * Deleted outputs are expunged from the database.
 */
function deleteBuildOutputs(build_id, outputs, options={}) {

    if (outputs.length == 0) {
        showAlertDialog(
            '{% trans "Select Build Outputs" %}',
            '{% trans "At least one build output must be selected" %}',
        );
        return;
    }

    // Construct table entries
    var table_entries = '';

    outputs.forEach(function(output) {
        table_entries += renderBuildOutput(output);
    });

    var html = `
    <div class='alert alert-block alert-danger'>
    {% trans "Selected build outputs will be deleted" %}
    <ul>
    <li>{% trans "Build output data will be permanently deleted" %}</li>
    <li>{% trans "Allocated stock items will be returned to stock" %}</li>
    </ul>
    </div>
    <table class='table table-striped table-condensed' id='build-complete-table'>
        <thead>
            <th colspan='2'>{% trans "Output" %}</th>
            <th><!-- Actions --></th>
        </thead>
        <tbody>
            ${table_entries}
        </tbody>
    </table>`;

    constructForm(`{% url "api-build-list" %}${build_id}/delete-outputs/`, {
        method: 'POST',
        preFormContent: html,
        fields: {},
        confirm: true,
        title: '{% trans "Delete Build Outputs" %}',
        afterRender: function(fields, opts) {
            // Setup callbacks to remove outputs
            $(opts.modal).find('.button-row-remove').click(function() {
                var pk = $(this).attr('pk');

                $(opts.modal).find(`#output_row_${pk}`).remove();
            });
        },
        onSubmit: function(fields, opts) {
            var data = {
                outputs: [],
            };

            var output_pk_values = [];

            outputs.forEach(function(output) {
                var pk = output.pk;

                var row = $(opts.modal).find(`#output_row_${pk}`);

                if (row.exists()) {
                    data.outputs.push({
                        output: pk
                    });
                    output_pk_values.push(pk);
                }
            });

            opts.nested = {
                'outputs': output_pk_values,
            };

            inventreePut(
                opts.url,
                data,
                {
                    method: 'POST',
                    success: function(response) {
                        $(opts.modal).modal('hide');

                        if (options.success) {
                            options.success(response);
                        }
                    },
                    error: function(xhr) {
                        switch (xhr.status) {
                        case 400:
                            handleFormErrors(xhr.responseJSON, fields, opts);
                            break;
                        default:
                            $(opts.modal).modal('hide');
                            showApiError(xhr, opts.url);
                            break;
                        }
                    }
                }
            );
        }
    });
}


/**
 * Load a table showing all the BuildOrder allocations for a given part
 */
function loadBuildOrderAllocationTable(table, options={}) {

    options.params['part_detail'] = true;
    options.params['build_detail'] = true;
    options.params['location_detail'] = true;
    options.params['stock_detail'] = true;

    var filters = loadTableFilters('buildorderallocation', options.params);

    setupFilterList('buildorderallocation', $(table));

    $(table).inventreeTable({
        url: '{% url "api-build-item-list" %}',
        queryParams: filters,
        name: 'buildorderallocation',
        groupBy: false,
        search: false,
        paginationVAlign: 'bottom',
        original: options.params,
        formatNoMatches: function() {
            return '{% trans "No build order allocations found" %}';
        },
        columns: [
            {
                field: 'pk',
                visible: false,
                switchable: false,
            },
            {
                field: 'build',
                switchable: false,
                title: '{% trans "Build Order" %}',
                formatter: function(value, row) {

                    var ref = `${row.build_detail.reference}`;

                    return renderLink(ref, `/build/${row.build}/`);
                }
            },
            {
                field: 'item',
                title: '{% trans "Stock Item" %}',
                formatter: function(value, row) {
                    // Render a link to the particular stock item

                    var link = `/stock/item/${row.stock_item}/`;
                    var text = `{% trans "Stock Item" %} ${row.stock_item}`;

                    return renderLink(text, link);
                }
            },
            {
                field: 'location',
                title: '{% trans "Location" %}',
                formatter: function(value, row) {

                    if (!value) {
                        return '{% trans "Location not specified" %}';
                    }

                    var link = `/stock/location/${value}`;
                    var text = row.location_detail.description;

                    return renderLink(text, link);
                }
            },
            {
                field: 'quantity',
                title: '{% trans "Quantity" %}',
                sortable: true,
            }
        ]
    });
}


/* Internal helper functions for performing calculations on BOM data */

// Iterate through a list of allocations, returning *only* those which match a particular BOM row
function getAllocationsForBomRow(row, allocations) {
    var part_id = row.sub_part;

    var matching_allocations = [];

    allocations.forEach(function(allocation) {
        if (allocation.bom_part == part_id) {
            matching_allocations.push(allocation);
        }
    });

    return matching_allocations;
}

// Sum the allocation quantity for a given BOM row
function sumAllocationsForBomRow(bom_row, allocations) {
    var quantity = 0;

    getAllocationsForBomRow(bom_row, allocations).forEach(function(allocation) {
        quantity += allocation.quantity;
    });

    return formatDecimal(quantity, 10);
}


/*
 * Display a "build output" table for a particular build.
 *
 * This displays a list of "active" (i.e. "in production") build outputs (stock items) for a given build.
 *
 * - Any required tests are displayed here for each output
 * - Additionally, if any tracked items are present in the build, the allocated items are displayed
 *
 */
function loadBuildOutputTable(build_info, options={}) {

    var table = options.table || '#build-output-table';

    var params = options.params || {};

    // test templates for the part being assembled
    let test_templates = null;

    // tracked line items for this build
    let has_tracked_lines = false;

    // Mandatory query filters
    params.part_detail = true;
    params.tests = true;
    params.is_building = true;
    params.build = build_info.pk;

    var filters = {};

    for (var key in params) {
        filters[key] = params[key];
    }

    setupFilterList('builditems', $(table), options.filterTarget || '#filter-list-incompletebuilditems', {
        labels: {
            url: '{% url "api-stockitem-label-list" %}',
            key: 'item',
        },
        singular_name: '{% trans "build output" %}',
        plural_name: '{% trans "build outputs" %}',
    });

    // Request list of required tests for the part being assembled
    inventreeGet(
        '{% url "api-part-test-template-list" %}',
        {
            part: build_info.part,
        },
        {
            async: false,
            success: function(response) {
                test_templates = response;
            }
        }
    );

    // Callback function to load the allocated stock items
    function reloadOutputAllocations() {
        inventreeGet(
            '{% url "api-build-line-list" %}',
            {
                build: build_info.pk,
                tracked: true,
            },
            {
                success: function(response) {
                    let build_lines = response.results || response;
                    let table_data = $(table).bootstrapTable('getData');

                    has_tracked_lines = build_lines.length > 0;

                    /* Iterate through each active build output and update allocations
                     * For each build output, we need to:
                     * - Append any existing allocations
                     * - Work out how many lines are "fully allocated"
                     */
                    for (var ii = 0; ii < table_data.length; ii++) {
                        let output = table_data[ii];

                        let fully_allocated = 0;

                        // Construct a list of allocations for this output
                        let lines = [];

                        // Iterate through each tracked build line item
                        for (let jj = 0; jj < build_lines.length; jj++) {

                            // Create a local copy of the build line
                            let line = Object.assign({}, build_lines[jj]);

                            let required = line.bom_item_detail.quantity * output.quantity;

                            let allocations = [];
                            let allocated = 0;

                            // Iterate through each allocation for this line item
                            for (let kk = 0; kk < line.allocations.length; kk++) {
                                let allocation = line.allocations[kk];

                                if (allocation.install_into == output.pk) {
                                    allocations.push(allocation);
                                    allocated += allocation.quantity;
                                }
                            }

                            line.allocations = allocations;
                            line.allocated = allocated;
                            line.quantity = required;

                            if (allocated >= required) {
                                fully_allocated += 1;
                            }

                            lines.push(line);
                        }

                        // Push the row back in
                        output.lines = lines;
                        output.fully_allocated = fully_allocated;
                        table_data[ii] = output;
                    }

                    // Update the table data
                    $(table).bootstrapTable('load', table_data);

                    if (has_tracked_lines) {
                        $(table).bootstrapTable('showColumn', 'fully_allocated');
                    } else {
                        $(table).bootstrapTable('hideColumn', 'fully_allocated');
                    }
                }
            }
        );
    }

    // Callback function to construct a child table
    function constructOutputSubTable(index, row, element) {
        let sub_table_id = `output-table-${row.pk}`;

        element.html(`
        <div class='sub-table'>
            <table class='table table-striped table-condensed' id='${sub_table_id}'></table>
        </div>
        `);

        loadBuildLineTable(
            `#${sub_table_id}`,
            build_info.pk,
            {
                output: row.pk,
                data: row.lines,
            }
        );
    }

    // Now, construct the actual table
    $(table).inventreeTable({
        url: '{% url "api-stock-list" %}',
        queryParams: filters,
        original: params,
        showColumns: true,
        uniqueId: 'pk',
        name: 'build-outputs',
        sortable: true,
        search: true,
        sidePagination: 'client',
        detailView: true,
        detailFilter: function(index, row) {
            return has_tracked_lines;
        },
        detailFormatter: function(index, row, element) {
            return constructOutputSubTable(index, row, element);
        },
        formatNoMatches: function() {
            return '{% trans "No active build outputs found" %}';
        },
        onLoadSuccess: function() {
            reloadOutputAllocations();
        },
        buttons: constructExpandCollapseButtons(table),
        columns: [
            {
                title: '',
                visible: true,
                checkbox: true,
                switchable: false,
            },
            {
                field: 'part',
                title: '{% trans "Part" %}',
                switchable: false,
                formatter: function(value, row) {
                    return imageHoverIcon(row.part_detail.thumbnail) +
                        renderLink(row.part_detail.full_name, `/part/${row.part_detail.pk}/`) +
                        makePartIcons(row.part_detail);
                }
            },
            {
                field: 'quantity',
                title: '{% trans "Build Output" %}',
                switchable: false,
                sortable: true,
                formatter: function(value, row) {
                    let text = '';

                    if (row.serial && row.quantity == 1) {
                        text = `{% trans "Serial Number" %}: ${row.serial}`;
                    } else {
                        text = `{% trans "Quantity" %}: ${row.quantity}`;

                    }

                    text = renderLink(text, `/stock/item/${row.pk}/`);

                    if (row.part_detail && row.part_detail.units) {
                        text += ` <small>[${row.part_detail.units}]</small>`;
                    }

                    if (row.batch) {
                        text += ` <small>({% trans "Batch" %}: ${row.batch})</small>`;
                    }

                    text += stockStatusDisplay(row.status, {classes: 'float-right'});

                    return text;
                }
            },
            {
                field: 'fully_allocated',
                title: '{% trans "Allocated Lines" %}',
                visible: false,
                sortable: true,
                switchable: false,
                formatter: function(value, row) {
                    if (!row.lines) {
                        return '-';
                    }

                    return makeProgressBar(row.fully_allocated, row.lines.length);
                }
            },
            {
                field: 'tests',
                title: '{% trans "Completed Tests" %}',
                sortable: true,
                visible: true, // TODO: Hide if no tests are defined
                switchable: true,
                formatter: function(value, row) {
                    return 'TODO: tests';
                }
            },
            {
                field: 'actions',
                title: '',
                switchable: false,
                formatter: function(value, row) {
                    return makeBuildOutputButtons(
                        row.pk,
                        build_info,
                        {
                            has_tracked_lines: has_tracked_lines,
                        }
                    )
                }
            }
        ]
    });

    /* Callbacks for the build output buttons */

    // Allocate stock button
    $(table).on('click', '.button-output-allocate', function() {
        let pk = $(this).attr('pk');

        // Retrieve build output row
        let output = $(table).bootstrapTable('getRowByUniqueId', pk);
        let lines = output.lines || [];

        allocateStockToBuild(
            build_info.pk,
            lines,
            {
                output: pk,
                success: function() {
                    $(table).bootstrapTable('refresh');
                    $('#build-stock-table').bootstrapTable('refresh');
                }
            }
        );
    });

    // Deallocate stock button
    $(table).on('click', '.button-output-deallocate', function() {
        let pk = $(this).attr('pk');

        deallocateStock(build_info.pk, {
            output: pk,
            table: table
        });
    });

    // Complete build output button
    $(table).on('click', '.button-output-complete', function() {
        let pk = $(this).attr('pk');
        let output = $(table).bootstrapTable('getRowByUniqueId', pk);

        completeBuildOutputs(
            build_info.pk,
            [output],
            {
                success: function() {
                    $(table).bootstrapTable('refresh');
                    $('#build-stock-table').bootstrapTable('refresh');
                }
            }
        );
    });

    // Scrap build output button
    $(table).on('click', '.button-output-scrap', function() {
        let pk = $(this).attr('pk');
        let output = $(table).bootstrapTable('getRowByUniqueId', pk);

        scrapBuildOutputs(
            build_info.pk,
            [output],
            {
                success: function() {
                    $(table).bootstrapTable('refresh');
                    $('#build-stock-table').bootstrapTable('refresh');
                }
            }
        );
    });

    // Remove build output button
    $(table).on('click', '.button-output-remove', function() {
        let pk = $(this).attr('pk');
        let output = $(table).bootstrapTable('getRowByUniqueId', pk);

        deleteBuildOutputs(
            build_info.pk,
            [output],
            {
                success: function() {
                    $(table).bootstrapTable('refresh');
                    $('#build-stock-table').bootstrapTable('refresh');
                }
            }
        );
    });

    // Complete multiple outputs
    $('#multi-output-complete').click(function() {
        var outputs = getTableData(table);

        completeBuildOutputs(
            build_info.pk,
            outputs,
            {
                success: function() {
                    // Reload the "in progress" table
                    $('#build-output-table').bootstrapTable('refresh');

                    // Reload the "completed" table
                    $('#build-stock-table').bootstrapTable('refresh');
                }
            }
        );
    });

    // Delete multiple build outputs
    $('#multi-output-delete').click(function() {
        var outputs = getTableData(table);

        deleteBuildOutputs(
            build_info.pk,
            outputs,
            {
                success: function() {
                    // Reload the "in progress" table
                    $('#build-output-table').bootstrapTable('refresh');

                    // Reload the "completed" table
                    $('#build-stock-table').bootstrapTable('refresh');
                }
            }
        );
    });

    // Scrap multiple outputs
    $('#multi-output-scrap').click(function() {
        var outputs = getTableData(table);

        scrapBuildOutputs(
            build_info.pk,
            outputs,
            {
                success: function() {
                    // Reload the "in progress" table
                    $('#build-output-table').bootstrapTable('refresh');

                    // Reload the "completed" table
                    $('#build-stock-table').bootstrapTable('refresh');
                }
            }
        );
    });

    $('#outputs-expand').click(function() {
        $(table).bootstrapTable('expandAllRows');
    });

    $('#outputs-collapse').click(function() {
        $(table).bootstrapTable('collapseAllRows');
    });

    return;
    inventreeGet(
        '{% url "api-build-line-list" %}',
        {
            build: build_info.pk,
            tracked: true,
        },
        {
            async: false,
            success: function(data) {
               tracked_lines = data.results || data;
            }
        }
    );

    function setupBuildOutputButtonCallbacks() {

        // Callback for the "allocate" button
        $(table).find('.button-output-allocate').click(function() {
            var pk = $(this).attr('pk');

            // Find the "allocation" sub-table associated with this output
            var sub_table = $(`#output-sub-table-${pk}`);

            if (sub_table.exists()) {
                var rows = getTableData(`#output-sub-table-${pk}`);

                allocateStockToBuild(
                    build_info.pk,
                    build_info.part,
                    rows,
                    {
                        output: pk,
                        success: function() {
                            $(table).bootstrapTable('refresh');
                        }
                    }
                );
            } else {
                console.warn(`Could not locate sub-table for output ${pk}`);
            }
        });

        // Callback for the "unallocate" button
        $(table).find('.button-output-unallocate').click(function() {
            var pk = $(this).attr('pk');

            deallocateStock(build_info.pk, {
                output: pk,
                table: table
            });
        });

        // Callback for the "complete" button
        $(table).find('.button-output-complete').click(function() {
            var pk = $(this).attr('pk');

            var output = $(table).bootstrapTable('getRowByUniqueId', pk);

            completeBuildOutputs(
                build_info.pk,
                [
                    output,
                ],
                {
                    success: function() {
                        $(table).bootstrapTable('refresh');
                        $('#build-stock-table').bootstrapTable('refresh');
                    }
                }
            );
        });

        // Callback for the "scrap" button
        $(table).find('.button-output-scrap').click(function() {
            var pk = $(this).attr('pk');
            var output = $(table).bootstrapTable('getRowByUniqueId', pk);

            scrapBuildOutputs(
                build_info.pk,
                [output],
                {
                    success: function() {
                        $(table).bootstrapTable('refresh');
                        $('#build-stock-table').bootstrapTable('refresh');
                    }
                }
            );
        });

        // Callback for the "remove" button
        $(table).find('.button-output-remove').click(function() {
            var pk = $(this).attr('pk');

            var output = $(table).bootstrapTable('getRowByUniqueId', pk);

            deleteBuildOutputs(
                build_info.pk,
                [
                    output,
                ],
                {
                    success: function() {
                        $(table).bootstrapTable('refresh');
                        $('#build-stock-table').bootstrapTable('refresh');
                    }
                }
            );
        });
    }

    /*
     * Construct a "sub table" showing the required BOM items
     */
    function constructBuildOutputSubTable(index, row, element) {
        var sub_table_id = `output-sub-table-${row.pk}`;

        var html = `
        <div class='sub-table'>
            <table class='table table-striped table-condensed' id='${sub_table_id}'></table>
        </div>
        `;

        element.html(html);

        // Pass through the cached BOM items
        build_info.bom_items = bom_items;

        loadBuildOutputAllocationTable(
            build_info,
            row,
            {
                table: `#${sub_table_id}`,
                parent_table: table,
            }
        );
    }

    function updateAllocationData(rows) {
        // Update stock allocation information for the build outputs

        // Request updated stock allocation data for this build order
        inventreeGet(
            '{% url "api-build-item-list" %}',
            {
                build: build_info.pk,
                part_detail: true,
                location_detail: true,
                sub_part_trackable: true,
                tracked: true,
            },
            {
                success: function(response) {

                    // Group allocation information by the "install_into" field
                    var allocations = {};

                    response.forEach(function(allocation) {
                        var target = allocation.install_into;

                        if (target != null) {
                            if (!(target in allocations)) {
                                allocations[target] = [];
                            }

                            allocations[target].push(allocation);
                        }
                    });

                    // Now that the allocations have been grouped by stock item,
                    // we can update each row in the table,
                    // using the pk value of each row (stock item)

                    var data = [];

                    rows.forEach(function(row) {
                        row.allocations = allocations[row.pk] || [];
                        data.push(row);

                        var n_completed_lines = 0;

                        // Check how many BOM lines have been completely allocated for this build output
                        tracked_lines.forEach(function(line) {

                            var required_quantity = line.bom_item_detail.quantity * row.quantity;

                            if (sumAllocationsForBomRow(line, row.allocations) >= required_quantity) {
                                n_completed_lines += 1;
                            }

                            var output_progress_bar = $(`#output-progress-${row.pk}`);

                            if (output_progress_bar.exists()) {
                                output_progress_bar.html(
                                    makeProgressBar(
                                        n_completed_lines,
                                        tracked_lines.length,
                                        {
                                            max_width: '150px',
                                        }
                                    )
                                );
                            }
                        });
                    });

                    // Reload table with updated data
                    $(table).bootstrapTable('load', data);
                }
            }
        );
    }

    var part_tests = null;

    function updateTestResultData(rows) {
        // Update test result information for the build outputs

        // Request test template data if it has not already been retrieved
        if (part_tests == null) {
            inventreeGet(
                '{% url "api-part-test-template-list" %}',
                {
                    part: build_info.part,
                    required: true,
                },
                {
                    success: function(response) {
                        // Save the list of part tests
                        part_tests = response;

                        // Callback to this function again
                        updateTestResultData(rows);
                    }
                }
            );

            return;
        }

        // Retrieve stock results for the entire build
        inventreeGet(
            '{% url "api-stock-test-result-list" %}',
            {
                build: build_info.pk,
                ordering: '-date',
            },
            {
                success: function(results) {

                    var data = [];
                    // Iterate through each row and find matching test results
                    rows.forEach(function(row) {
                        var test_results = {};

                        results.forEach(function(result) {
                            if (result.stock_item == row.pk) {
                                // This test result matches the particular stock item

                                if (!(result.key in test_results)) {
                                    test_results[result.key] = result.result;
                                }
                            }
                        });

                        row.passed_tests = test_results;

                        data.push(row);
                    });

                    $(table).bootstrapTable('load', data);
                }
            }
        );
    }

    // Return the number of 'passed' tests in a given row
    function countPassedTests(row) {
        if (part_tests == null) {
            return 0;
        }

        var results = row.passed_tests || {};
        var n = 0;

        part_tests.forEach(function(test) {
            if (results[test.key] || false) {
                n += 1;
            }
        });

        return n;
    }

    // Return the number of 'fully allocated' lines for a given row
    function countAllocatedLines(row) {
        var n_completed_lines = 0;

        tracked_lines.forEach(function(row) {

            var required_quantity = row.bom_item_detail.quantity * row.quantity;

            if (sumAllocationsForBomRow(row, row.allocations || []) >= required_quantity) {
                n_completed_lines += 1;
            }
        });

        return n_completed_lines;
    }

    $(table).inventreeTable({
        url: '{% url "api-stock-list" %}',
        queryParams: filters,
        original: params,
        showColumns: true,
        uniqueId: 'pk',
        name: 'build-outputs',
        sortable: true,
        search: true,
        sidePagination: 'client',
        detailView: tracked_lines.length > 0,
        detailFilter: function(index, row) {
            return tracked_lines.length > 0;
        },
        detailFormatter: function(index, row, element) {
            constructBuildOutputSubTable(index, row, element);
        },
        formatNoMatches: function() {
            return '{% trans "No active build outputs found" %}';
        },
        onPostBody: function(rows) {
            // Add callbacks for the buttons
            setupBuildOutputButtonCallbacks();
        },
        onLoadSuccess: function(rows) {
            updateAllocationData(rows);
            updateTestResultData(rows);
        },
        buttons: constructExpandCollapseButtons(table),
        columns: [
            {
                title: '',
                visible: true,
                checkbox: true,
                switchable: false,
            },
            {
                field: 'part',
                title: '{% trans "Part" %}',
                switchable: true,
                formatter: function(value, row) {
                    var thumb = row.part_detail.thumbnail;

                    return imageHoverIcon(thumb) + row.part_detail.full_name + makePartIcons(row.part_detail);
                }
            },
            {
                field: 'quantity',
                title: '{% trans "Build Output" %}',
                switchable: false,
                sortable: true,
                formatter: function(value, row) {

                    var url = `/stock/item/${row.pk}/`;

                    var text = '';

                    if (row.serial && row.quantity == 1) {
                        text = `{% trans "Serial Number" %}: ${row.serial}`;
                    } else {
                        text = `{% trans "Quantity" %}: ${row.quantity}`;
                        if (row.part_detail && row.part_detail.units) {
                            text += ` <small>${row.part_detail.units}</small>`;
                        }
                    }

                    text = renderLink(text, url);

                    if (row.batch) {
                        text += ` <small>({% trans "Batch" %}: ${row.batch})</small>`;
                    }

                    text += stockStatusDisplay(row.status, {classes: 'float-right'});

                    return text;
                },
                sorter: function(a, b, row_a, row_b) {
                    // Sort first by quantity, and then by serial number
                    if ((row_a.quantity > 1) || (row_b.quantity > 1)) {
                        return row_a.quantity > row_b.quantity ? 1 : -1;
                    }

                    if ((row_a.serial != null) && (row_b.serial != null)) {
                        var sn_a = Number.parseInt(row_a.serial) || 0;
                        var sn_b = Number.parseInt(row_b.serial) || 0;

                        return sn_a > sn_b ? 1 : -1;
                    }

                    return 0;
                }
            },
            {
                field: 'allocated',
                title: '{% trans "Allocated Stock" %}',
                visible: tracked_lines.length > 0,
                switchable: false,
                sortable: true,
                formatter: function(value, row) {

                    if (tracked_lines.length == 0) {
                        return `<div id='output-progress-${row.pk}'><em><small>{% trans "No tracked BOM items for this build" %}</small></em></div>`;
                    }

                    var progressBar = makeProgressBar(
                        countAllocatedLines(row),
                        tracked_lines.length,
                        {
                            max_width: '150px',
                        }
                    );

                    return `<div id='output-progress-${row.pk}'>${progressBar}</div>`;
                },
                sorter: function(value_a, value_b, row_a, row_b) {
                    var q_a = countAllocatedLines(row_a);
                    var q_b = countAllocatedLines(row_b);

                    return q_a > q_b ? 1 : -1;
                },
            },
            {
                field: 'tests',
                title: '{% trans "Completed Tests" %}',
                sortable: true,
                switchable: true,
                formatter: function(value, row) {
                    if (part_tests == null || part_tests.length == 0) {
                        return `<em><small>{% trans "No required tests for this build" %}</small></em>`;
                    }

                    var n_passed = countPassedTests(row);

                    var progress = makeProgressBar(
                        n_passed,
                        part_tests.length,
                        {
                            max_width: '150px',
                        }
                    );

                    return progress;
                },
                sorter: function(a, b, row_a, row_b) {
                    var n_a = countPassedTests(row_a);
                    var n_b = countPassedTests(row_b);

                    return n_a > n_b ? 1 : -1;
                }
            },
            {
                field: 'actions',
                title: '',
                switchable: false,
                formatter: function(value, row) {
                    return makeBuildOutputButtons(
                        row.pk,
                        build_info,
                        {
                            has_bom_items: tracked_lines.length > 0,
                        }
                    );
                }
            }
        ]
    });

    // Add callbacks for the various table menubar buttons
}


/*
 * Display the "allocation table" for a particular build output.
 *
 * This displays a table of required allocations for a particular build output
 *
 * Args:
 * - buildId: The PK of the Build object
 * - partId: The PK of the Part object
 * - output: The StockItem object which is the "output" of the build
 * - options:
 * -- table: The #id of the table (will be auto-calculated if not provided)
 */
function loadBuildOutputAllocationTable(buildInfo, output, options={}) {

    var buildId = buildInfo.pk;
    var partId = buildInfo.part;

    var outputId = null;

    if (output) {
        outputId = output.pk;
    } else {
        outputId = 'untracked';
    }

    var bom_items = buildInfo.bom_items || null;

    function loadBomData() {
        let data = [];

        inventreeGet(
            '{% url "api-bom-list" %}',
            {
                part: partId,
                sub_part_detail: true,
                sub_part_trackable: buildInfo.tracked_parts,
            },
            {
                async: false,
                success: function(results) {
                    data = results;
                }
            }
        );

        return data;
    }

    // If BOM items have not been provided, load via the API
    if (bom_items == null) {
        bom_items = loadBomData();
    }

    // Apply filters to build table
    // As the table is constructed locally, we can apply filters directly
    function filterBuildAllocationTable(filters={}) {
        $(table).bootstrapTable(
            'filterBy',
            filters,
            {
                'filterAlgorithm': function(row, filters) {
                    let result = true;

                    if (!filters) {
                        return true;
                    }

                    // Filter by 'consumable' flag
                    if ('consumable' in filters) {
                        result &= filters.consumable == '1' ? row.consumable : !row.consumable;
                    }

                    // Filter by 'optional' flag
                    if ('optional' in filters) {
                        result &= filters.optional == '1' ? row.optional : !row.optional;
                    }

                    // Filter by 'allocated' flag
                    if ('allocated' in filters) {
                        let fully_allocated = row.consumable || isRowFullyAllocated(row);
                        result &= filters.allocated == '1' ? fully_allocated : !fully_allocated;
                    }

                    // Filter by 'available' flag
                    if ('available' in filters) {
                        let available = row.available_stock > 0;
                        result &= filters.available == '1' ? available : !available;
                    }

                    return result;
                }
            }
        );
    }

    var table = options.table || `#allocation-table-${outputId}`;

    // Filters
    let filters = loadTableFilters('builditems', options.params);

    setupFilterList('builditems', $(table), options.filterTarget, {
        callback: function(table, filters, options) {
            if (filters == null) {
                // Destroy and re-create the table from scratch
                $(table).bootstrapTable('destroy');
                loadBuildOutputAllocationTable(buildInfo, output, options);
            } else {
                filterBuildAllocationTable(filters);
            }
        }
    });

    var allocated_items = output == null ? null : output.allocations;

    function redrawAllocationData() {
        // Force a refresh of each row in the table
        // Note we cannot call 'refresh' because we are passing data from memory

        // How many rows are fully allocated?
        var allocated_rows = 0;

        for (var idx = 0; idx < bom_items.length; idx++) {
            var row = bom_items[idx];

            if (isRowFullyAllocated(row)) {
                allocated_rows++;
            }
        }

        // Reload table data
        $(table).bootstrapTable('load', bom_items);

        // Find the top-level progress bar for this build output
        var output_progress_bar = $(`#output-progress-${outputId}`);

        if (output_progress_bar.exists()) {
            if (bom_items.length > 0) {
                output_progress_bar.html(
                    makeProgressBar(
                        allocated_rows,
                        bom_items.length,
                        {
                            max_width: '150px',
                        }
                    )
                );
            }
        } else {
            console.warn(`Could not find progress bar for output '${outputId}'`);
        }
    }

    function reloadAllocationData(async=true) {
        // Reload stock allocation data for this particular build output

        inventreeGet(
            '{% url "api-build-item-list" %}',
            {
                build: buildId,
                part_detail: true,
                location_detail: true,
                output: output == null ? null : output.pk,
            },
            {
                async: async,
                success: function(response) {
                    allocated_items = response;

                    redrawAllocationData();

                }
            }
        );
    }

    if (allocated_items == null) {
        // No allocation data provided? Request from server (blocking)
        reloadAllocationData(false);
    } else {
        redrawAllocationData();
    }

    function requiredQuantity(row) {
        // Return the required quantity for a given row

        var quantity = 0;

        if (output) {
            // "Tracked" parts are calculated against individual build outputs
            quantity = row.quantity * output.quantity;
        } else {
            // "Untracked" parts are specified against the build itself
            quantity = row.quantity * buildInfo.quantity;
        }

        // Store the required quantity in the row data
        // Prevent weird rounding issues
        row.required = formatDecimal(quantity, 15);
        return row.required;
    }

    function availableQuantity(row) {
        // Return the total available stock for a given row

        // Base stock
        var available = row.available_stock;

        // Substitute stock
        available += (row.available_substitute_stock || 0);

        // Variant stock
        if (row.allow_variants) {
            available += (row.available_variant_stock || 0);
        }

        return available;
    }

    function allocatedQuantity(row) {
        row.allocated = sumAllocationsForBomRow(row, allocated_items);
        return row.allocated;
    }

    function isRowFullyAllocated(row) {
        return allocatedQuantity(row) >= requiredQuantity(row);
    }

    function setupCallbacks() {
        // Register button callbacks once table data are loaded

        // Callback for 'allocate' button
        $(table).find('.button-add').click(function() {

            // Primary key of the 'sub_part'
            var pk = $(this).attr('pk');

            // Extract BomItem information from this row
            var row = $(table).bootstrapTable('getRowByUniqueId', pk);

            if (!row) {
                console.warn('getRowByUniqueId returned null');
                return;
            }

            allocateStockToBuild(
                buildId,
                partId,
                [
                    row,
                ],
                {
                    source_location: buildInfo.source_location,
                    success: function(data) {
                        // $(table).bootstrapTable('refresh');
                        reloadAllocationData();
                    },
                    output: output == null ? null : output.pk,
                }
            );
        });

        // Callback for 'buy' button
        $(table).find('.button-buy').click(function() {

            var pk = $(this).attr('pk');

            inventreeGet(
                `/api/part/${pk}/`,
                {},
                {
                    success: function(part) {
                        orderParts(
                            [part],
                            {}
                        );
                    }
                }
            );
        });

        // Callback for 'build' button
        $(table).find('.button-build').click(function() {
            var pk = $(this).attr('pk');

            // Extract row data from the table
            var idx = $(this).closest('tr').attr('data-index');
            var row = $(table).bootstrapTable('getData')[idx];

            newBuildOrder({
                part: pk,
                parent: buildId,
                quantity: requiredQuantity(row) - allocatedQuantity(row),
            });
        });

        // Callback for 'unallocate' button
        $(table).find('.button-unallocate').click(function() {

            // Extract row data from the table
            var idx = $(this).closest('tr').attr('data-index');
            var row = $(table).bootstrapTable('getData')[idx];

            deallocateStock(buildId, {
                bom_item: row.pk,
                output: outputId == 'untracked' ? null : outputId,
                table: table,
                onSuccess: function(response, opts) {
                    reloadAllocationData();
                }
            });
        });
    }

    // Load table of BOM items
    $(table).inventreeTable({
        data: bom_items,
        disablePagination: true,
        formatNoMatches: function() {
            return '{% trans "No BOM items found" %}';
        },
        name: 'build-allocation',
        uniqueId: 'sub_part',
        search: options.search || false,
        queryParams: filters,
        original: options.params,
        onRefresh: function(data) {
            filterBuildAllocationTable(filters);
        },
        onPostBody: function(data) {
            // Setup button callbacks
            setupCallbacks();
        },
        sortable: true,
        showColumns: true,
        detailView: true,
        detailFilter: function(index, row) {
            return allocatedQuantity(row) > 0;
        },
        buttons: constructExpandCollapseButtons(table),
        detailFormatter: function(index, row, element) {
            // Construct an 'inner table' which shows which stock items have been allocated

            var subTableId = `allocation-table-${outputId}-${row.pk}`;

            var html = `<div class='sub-table'><table class='table table-condensed table-striped' id='${subTableId}'></table></div>`;

            element.html(html);

            var subTable = $(`#${subTableId}`);

            subTable.bootstrapTable({
                data: getAllocationsForBomRow(row, allocated_items),
                showHeader: true,
                columns: [
                    {
                        field: 'part',
                        title: '{% trans "Part" %}',
                        formatter: function(value, row) {

                            var html = imageHoverIcon(row.part_detail.thumbnail);
                            html += renderLink(row.part_detail.full_name, `/part/${value}/`);
                            return html;
                        }
                    },
                    {
                        width: '50%',
                        field: 'quantity',
                        title: '{% trans "Assigned Stock" %}',
                        formatter: function(value, row) {
                            var text = '';

                            var url = '';

                            var serial = row.serial;

                            if (row.stock_item_detail) {
                                serial = row.stock_item_detail.serial;
                            }

                            if (serial && row.quantity == 1) {
                                text = `{% trans "Serial Number" %}: ${serial}`;
                            } else {
                                text = `{% trans "Quantity" %}: ${row.quantity}`;
                                if (row.part_detail && row.part_detail.units) {
                                    text += ` <small>${row.part_detail.units}</small>`;
                                }
                            }

                            var pk = row.stock_item || row.pk;

                            url = `/stock/item/${pk}/`;

                            return renderLink(text, url);
                        }
                    },
                    {
                        field: 'location',
                        title: '{% trans "Location" %}',
                        formatter: function(value, row) {

                            if (row.location && row.location_detail) {
                                var text = shortenString(row.location_detail.pathstring);
                                var url = `/stock/location/${row.location}/`;

                                return renderLink(text, url);
                            } else {
                                return '<i>{% trans "No location set" %}</i>';
                            }
                        }
                    },
                    {
                        field: 'actions',
                        formatter: function(value, row) {
                            /* Actions available for a particular stock item allocation:
                             *
                             * - Edit the allocation quantity
                             * - Delete the allocation
                             */

                            var pk = row.pk;

                            var html = '';

                            html += makeEditButton('button-allocation-edit', pk, '{% trans "Edit stock allocation" %}');

                            html += makeDeleteButton('button-allocation-delete', pk, '{% trans "Delete stock allocation" %}');

                            return wrapButtons(html);
                        }
                    }
                ]
            });

            // Assign button callbacks to the newly created allocation buttons
            subTable.find('.button-allocation-edit').click(function() {
                var pk = $(this).attr('pk');

                constructForm(`{% url "api-build-item-list" %}${pk}/`, {
                    fields: {
                        quantity: {},
                    },
                    title: '{% trans "Edit Allocation" %}',
                    onSuccess: reloadAllocationData,
                });
            });

            subTable.find('.button-allocation-delete').click(function() {
                var pk = $(this).attr('pk');

                constructForm(`{% url "api-build-item-list" %}${pk}/`, {
                    method: 'DELETE',
                    title: '{% trans "Remove Allocation" %}',
                    onSuccess: reloadAllocationData,
                });
            });
        },
        columns: [
            {
                visible: true,
                switchable: false,
                checkbox: true,
            },
            {
                field: 'sub_part_detail.full_name',
                title: '{% trans "Required Part" %}',
                sortable: true,
                switchable: false,
                formatter: function(value, row) {
                    var url = `/part/${row.sub_part}/`;
                    var thumb = row.sub_part_detail.thumbnail;
                    var name = row.sub_part_detail.full_name;

                    var html = imageHoverIcon(thumb) + renderLink(name, url);

                    html += makePartIcons(row.sub_part_detail);

                    if (row.substitutes && row.substitutes.length > 0) {
                        html += makeIconBadge('fa-exchange-alt', '{% trans "Substitute parts available" %}');
                    }

                    if (row.allow_variants) {
                        html += makeIconBadge('fa-sitemap', '{% trans "Variant stock allowed" %}');
                    }

                    return html;
                }
            },
            {
                field: 'reference',
                title: '{% trans "Reference" %}',
                sortable: true,
                switchable: true,
            },
            {
                field: 'consumable',
                title: '{% trans "Consumable" %}',
                sortable: true,
                switchable: true,
                formatter: function(value) {
                    return yesNoLabel(value);
                }
            },
            {
                field: 'optional',
                title: '{% trans "Optional" %}',
                sortable: true,
                switchable: true,
                formatter: function(value) {
                    return yesNoLabel(value);
                }
            },
            {
                field: 'quantity',
                title: '{% trans "Quantity Per" %}',
                sortable: true,
                switchable: false,
                formatter: function(value, row) {
                    var text = value;

                    if (row.sub_part_detail && row.sub_part_detail.units) {
                        text += ` <small>${row.sub_part_detail.units}</small>`;
                    }
                    return text;
                }
            },
            {
                field: 'available_stock',
                title: '{% trans "Available" %}',
                sortable: true,
                switchable: true,
                formatter: function(value, row) {

                    var url = `/part/${row.sub_part_detail.pk}/?display=part-stock`;

                    // Calculate total "available" (unallocated) quantity
                    var substitute_stock = row.available_substitute_stock || 0;
                    var variant_stock = row.allow_variants ? (row.available_variant_stock || 0) : 0;

                    var available_stock = availableQuantity(row);

                    var required = requiredQuantity(row);
                    var allocated = allocatedQuantity(row);

                    var text = '';

                    if (available_stock > 0) {
                        text += `${available_stock}`;
                        if (row.sub_part_detail && row.sub_part_detail.units) {
                            text += ` <small>${row.sub_part_detail.units}</small>`;
                        }
                    }

                    var icons = '';

                    if (row.consumable) {
                        icons += `<span class='fas fa-info-circle icon-blue float-right' title='{% trans "Consumable item" %}'></span>`;
                    } else {
                        if (available_stock < (required - allocated)) {
                            icons += makeIconBadge('fa-times-circle icon-red', '{% trans "Insufficient stock available" %}');
                        } else {
                            icons += makeIconBadge('fa-check-circle icon-green', '{% trans "Sufficient stock available" %}');
                        }

                        if (available_stock <= 0) {
                            icons += `<span class='badge rounded-pill bg-danger'>{% trans "No Stock Available" %}</span>`;
                        } else {
                            let extra = '';
                            if ((substitute_stock > 0) && (variant_stock > 0)) {
                                extra = '{% trans "Includes variant and substitute stock" %}';
                            } else if (variant_stock > 0) {
                                extra = '{% trans "Includes variant stock" %}';
                            } else if (substitute_stock > 0) {
                                extra = '{% trans "Includes substitute stock" %}';
                            }

                            if (extra) {
                                icons += makeIconBadge('fa-info-circle icon-blue', extra);
                            }
                        }
                    }

                    if (row.on_order && row.on_order > 0) {
                        icons += makeIconBadge('fa-shopping-cart', '{% trans "On Order" %}: ' + row.on_order);
                    }

                    return renderLink(text, url) + icons;
                },
                sorter: function(valA, valB, rowA, rowB) {

                    return availableQuantity(rowA) > availableQuantity(rowB) ? 1 : -1;
                },
            },
            {
                field: 'allocated',
                title: '{% trans "Allocated" %}',
                sortable: true,
                switchable: false,
                formatter: function(value, row) {
                    var required = requiredQuantity(row);
                    var allocated = row.consumable ? required : allocatedQuantity(row);
                    var progressbar_text = `${allocated} / ${required}`;
                    if (row.sub_part_detail && row.sub_part_detail.units) {
                        progressbar_text += ` ${row.sub_part_detail.units}`;
                    }
                    return makeProgressBar(allocated, required, {text: progressbar_text});
                },
                sorter: function(valA, valB, rowA, rowB) {
                    // Custom sorting function for progress bars

                    var aA = allocatedQuantity(rowA);
                    var aB = allocatedQuantity(rowB);

                    var qA = requiredQuantity(rowA);
                    var qB = requiredQuantity(rowB);

                    // Handle the case where both numerators are zero
                    if ((aA == 0) && (aB == 0)) {
                        return (qA > qB) ? 1 : -1;
                    }

                    // Handle the case where either denominator is zero
                    if ((qA == 0) || (qB == 0)) {
                        return 1;
                    }

                    var progressA = parseFloat(aA) / qA;
                    var progressB = parseFloat(aB) / qB;

                    // Handle the case where both ratios are equal
                    if (progressA == progressB) {
                        return (qA > qB) ? 1 : -1;
                    }

                    if (progressA == progressB) return 0;

                    return (progressA > progressB) ? 1 : -1;
                }
            },
            {
                field: 'actions',
                title: '{% trans "Actions" %}',
                switchable: false,
                sortable: false,
                formatter: function(value, row) {

                    if (row.consumable) {
                        return `<em>{% trans "Consumable item" %}</em>`;
                    }

                    // Generate action buttons for this build output
                    let html = '';

                    if (allocatedQuantity(row) < requiredQuantity(row)) {
                        if (row.sub_part_detail.assembly) {
                            html += makeIconButton('fa-tools icon-blue', 'button-build', row.sub_part, '{% trans "Build stock" %}');
                        }

                        if (row.sub_part_detail.purchaseable) {
                            html += makeIconButton('fa-shopping-cart icon-blue', 'button-buy', row.sub_part, '{% trans "Order stock" %}');
                        }

                        html += makeIconButton('fa-sign-in-alt icon-green', 'button-add', row.sub_part, '{% trans "Allocate stock" %}');
                    }

                    html += makeRemoveButton(
                        'button-unallocate',
                        row.sub_part,
                        '{% trans "Deallocate stock" %}',
                        {
                            disabled: allocatedQuantity(row) == 0,
                        }
                    );

                    return wrapButtons(html);
                }
            },
        ]
    });

    filterBuildAllocationTable(filters);
}



/**
 * Allocate stock items to a build
 *
 * arguments:
 * - buildId: ID / PK value for the build
 * - partId: ID / PK value for the part being built
 * - line_items: A list of BuildItem objects to be allocated
 *
 * options:
 *  - output: ID / PK of the associated build output (or null for untracked items)
 *  - source_location: ID / PK of the top-level StockLocation to source stock from (or null)
 */
function allocateStockToBuild(build_id, line_items, options={}) {

    if (line_items.length == 0) {

        showAlertDialog(
            '{% trans "Select Parts" %}',
            '{% trans "You must select at least one part to allocate" %}',
        );

        return;
    }

    let build = null;

    // Extract build information
    inventreeGet(`{% url "api-build-list" %}${build_id}/`, {}, {
        async: false,
        success: function(response) {
            build = response;
        }
    });

    if (!build) {
        console.error(`Failed to find build ${build_id}`);
        return;
    }

    // ID of the associated "build output" (stock item) (or null)
    var output_id = options.output || null;

    var auto_fill_filters = {};

    var source_location = options.source_location;

    if (output_id) {
        // Request information on the particular build output (stock item)
        inventreeGet(`{% url "api-stock-list" %}${output_id}/`, {}, {
            async: false,
            success: function(output) {
                if (output.quantity == 1 && output.serial != null) {
                    auto_fill_filters.serial = output.serial;
                }
            },
        });
    }

    function renderBuildLineRow(build_line, quantity) {

        var pk = build_line.pk;
        var sub_part = build_line.part_detail;

        var thumb = thumbnailImage(sub_part.thumbnail);

        var delete_button = `<div class='btn-group float-right' role='group'>`;

        delete_button += makeRemoveButton(
            'button-row-remove',
            pk,
            '{% trans "Remove row" %}',
        );

        delete_button += `</div>`;

        var quantity_input = constructField(
            `items_quantity_${pk}`,
            {
                type: 'decimal',
                min_value: 0,
                value: quantity || 0,
                title: '{% trans "Specify stock allocation quantity" %}',
                required: true,
            },
            {
                hideLabels: true,
            }
        );

        var allocated_display = makeProgressBar(
            build_line.allocated,
            build_line.quantity,
        );

        var stock_input = constructField(
            `items_stock_item_${pk}`,
            {
                type: 'related field',
                required: 'true',
            },
            {
                hideLabels: true,
            }
        );

        var html = `
        <tr id='items_${pk}' class='part-allocation-row'>
            <td id='part_${pk}'>
                ${thumb} ${sub_part.full_name}
            </td>
            <td id='allocated_${pk}'>
                ${allocated_display}
            </td>
            <td id='stock_item_${pk}'>
                ${stock_input}
            </td>
            <td id='quantity_${pk}'>
                ${quantity_input}
            </td>
            <td id='buttons_${pk}'>
                ${delete_button}
            </td>
        </tr>
        `;

        return html;
    }

    var table_entries = '';

    for (var idx = 0; idx < line_items.length; idx++) {
        let item = line_items[idx];

        // Ignore "consumable" BOM items
        if (item.part_detail.consumable) {
            continue;
        }

        var required = item.quantity || 0;
        var allocated = item.allocated || 0;
        var remaining = required - allocated;

        if (remaining < 0) {
            remaining = 0;
        }

        // Ensure the quantity sent to the form field is correctly formatted
        remaining = formatDecimal(remaining, 15);

        // We only care about entries which are not yet fully allocated
        if (remaining > 0) {
            table_entries += renderBuildLineRow(item, remaining);
        }
    }

    if (table_entries.length == 0) {

        showAlertDialog(
            '{% trans "All Parts Allocated" %}',
            '{% trans "All selected parts have been fully allocated" %}',
        );

        return;
    }

    var html = ``;

    // Render a "source location" input
    html += constructField(
        'take_from',
        {
            type: 'related field',
            label: '{% trans "Source Location" %}',
            help_text: '{% trans "Select source location (leave blank to take from all locations)" %}',
            required: false,
        },
        {},
    );

    // Create table of parts
    html += `
    <table class='table table-striped table-condensed' id='stock-allocation-table'>
        <thead>
            <tr>
                <th>{% trans "Part" %}</th>
                <th>{% trans "Allocated" %}</th>
                <th style='min-width: 250px;'>{% trans "Stock Item" %}</th>
                <th>{% trans "Quantity" %}</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            ${table_entries}
        </tbody>
    </table>
    `;

    constructForm(`{% url "api-build-list" %}${build_id}/allocate/`, {
        method: 'POST',
        fields: {},
        preFormContent: html,
        title: '{% trans "Allocate Stock Items to Build Order" %}',
        afterRender: function(fields, options) {

            var take_from_field = {
                name: 'take_from',
                model: 'stocklocation',
                api_url: '{% url "api-location-list" %}',
                required: false,
                type: 'related field',
                value: source_location,
                noResults: function(query) {
                    return '{% trans "No matching stock locations" %}';
                },
            };

            // Initialize "take from" field
            initializeRelatedField(
                take_from_field,
                null,
                options,
            );

            // Add callback to "clear" button for take_from field
            addClearCallback(
                'take_from',
                take_from_field,
                options,
            );

            // Initialize stock item fields
            line_items.forEach(function(line_item) {
                initializeRelatedField(
                    {
                        name: `items_stock_item_${line_item.pk}`,
                        api_url: '{% url "api-stock-list" %}',
                        filters: {
                            bom_item: line_item.bom_item_detail.pk,
                            in_stock: true,
                            available: true,
                            part_detail: true,
                            location_detail: true,
                        },
                        model: 'stockitem',
                        required: true,
                        render_part_detail: true,
                        render_location_detail: true,
                        render_pk: false,
                        render_available_quantity: true,
                        auto_fill: true,
                        auto_fill_filters: auto_fill_filters,
                        onSelect: function(data, field, opts) {
                            // Adjust the 'quantity' field based on availability

                            if (!('quantity' in data)) {
                                return;
                            }

                            // Quantity remaining to be allocated
                            var remaining = Math.max((line_item.quantity || 0) - (line_item.allocated || 0), 0);

                            // Calculate the available quantity
                            var available = Math.max((data.quantity || 0) - (data.allocated || 0), 0);

                            // Maximum amount that we need
                            var desired = Math.min(available, remaining);

                            updateFieldValue(`items_quantity_${line_item.pk}`, desired, {}, opts);
                        },
                        adjustFilters: function(filters) {
                            // Restrict query to the selected location
                            var location = getFormFieldValue(
                                'take_from',
                                {},
                                {
                                    modal: options.modal,
                                }
                            );

                            filters.location = location;
                            filters.cascade = true;

                            return filters;
                        },
                        noResults: function(query) {
                            return '{% trans "No matching stock items" %}';
                        }
                    },
                    null,
                    options,
                );
            });

            // Add remove-row button callbacks
            $(options.modal).find('.button-row-remove').click(function() {
                var pk = $(this).attr('pk');

                $(options.modal).find(`#items_${pk}`).remove();
            });
        },
        onSubmit: function(fields, opts) {

            // Extract elements from the form
            var data = {
                items: []
            };

            var item_pk_values = [];

            line_items.forEach(function(item) {

                var quantity = getFormFieldValue(
                    `items_quantity_${item.pk}`,
                    {},
                    {
                        modal: opts.modal,
                    },
                );

                var stock_item = getFormFieldValue(
                    `items_stock_item_${item.pk}`,
                    {},
                    {
                        modal: opts.modal,
                    }
                );

                if (quantity != null) {
                    data.items.push({
                        build_line: item.pk,
                        stock_item: stock_item,
                        quantity: quantity,
                        output: output_id,
                    });

                    item_pk_values.push(item.pk);
                }
            });

            // Provide nested values
            opts.nested = {
                'items': item_pk_values
            };

            inventreePut(
                opts.url,
                data,
                {
                    method: 'POST',
                    success: function(response) {
                        // Hide the modal
                        $(opts.modal).modal('hide');

                        if (options.success) {
                            options.success(response);
                        }
                    },
                    error: function(xhr) {
                        switch (xhr.status) {
                        case 400:
                            handleFormErrors(xhr.responseJSON, fields, opts);
                            break;
                        default:
                            $(opts.modal).modal('hide');
                            showApiError(xhr, opts.url);
                            break;
                        }
                    }
                }
            );
        },
    });
}


/**
 * Automatically allocate stock items to a build
 */
function autoAllocateStockToBuild(build_id, bom_items=[], options={}) {

    var html = `
    <div class='alert alert-block alert-info'>
    <strong>{% trans "Automatic Stock Allocation" %}</strong><br>
    {% trans "Stock items will be automatically allocated to this build order, according to the provided guidelines" %}:
    <ul>
        <li>{% trans "If a location is specified, stock will only be allocated from that location" %}</li>
        <li>{% trans "If stock is considered interchangeable, it will be allocated from the first location it is found" %}</li>
        <li>{% trans "If substitute stock is allowed, it will be used where stock of the primary part cannot be found" %}</li>
    </ul>
    </div>
    `;

    var fields = {
        location: {
            value: options.location,
            filters: {
                structural: false,
            }
        },
        exclude_location: {},
        interchangeable: {
            value: true,
        },
        substitutes: {
            value: true,
        },
        optional_items: {
            value: false,
        },
    };

    constructForm(`{% url "api-build-list" %}${build_id}/auto-allocate/`, {
        method: 'POST',
        fields: fields,
        title: '{% trans "Allocate Stock Items" %}',
        confirm: true,
        preFormContent: html,
        onSuccess: function(response) {
            if (options.onSuccess) {
                options.onSuccess(response);
            }
        }
    });
}


/*
 * Display a table of Build orders
 */
function loadBuildTable(table, options) {

    // Ensure the table starts in a known state
    $(table).bootstrapTable('destroy');

    var params = options.params || {};

    params['part_detail'] = true;

    var filters = loadTableFilters('build', params);

    var calendar = null;

    var filterTarget = options.filterTarget || null;

    setupFilterList('build', table, filterTarget, {
        download: true,
        report: {
            url: '{% url "api-build-report-list" %}',
            key: 'build',
        }
    });

    // Which display mode to use for the build table?
    var display_mode = inventreeLoad('build-table-display-mode', 'list');
    var tree_enable = display_mode == 'tree';

    var loaded_calendar = false;

    // Function for rendering BuildOrder calendar display
    function buildEvents(calendar) {
        var start = startDate(calendar);
        var end = endDate(calendar);

        clearEvents(calendar);

        // Extract current filters from table
        var table_options = $(table).bootstrapTable('getOptions');
        var filters = table_options.query_params || {};

        filters.min_date = start;
        filters.max_date = end;
        filters.part_detail = true;

        // Request build orders from the server within specified date range
        inventreeGet(
            '{% url "api-build-list" %}',
            filters,
            {
                success: function(response) {

                    for (var idx = 0; idx < response.length; idx++) {

                        var order = response[idx];

                        var date = order.creation_date;

                        if (order.completion_date) {
                            date = order.completion_date;
                        } else if (order.target_date) {
                            date = order.target_date;
                        }

                        var title = `${order.reference}`;

                        var color = '#4c68f5';

                        if (order.completed) {
                            color = '#25c234';
                        } else if (order.overdue) {
                            color = '#c22525';
                        }

                        var event = {
                            title: title,
                            start: date,
                            end: date,
                            url: `/build/${order.pk}/`,
                            backgroundColor: color,
                        };

                        calendar.addEvent(event);
                    }
                }
            }
        );
    }

    $(table).inventreeTable({
        method: 'get',
        formatNoMatches: function() {
            return '{% trans "No builds matching query" %}';
        },
        url: '{% url "api-build-list" %}',
        queryParams: filters,
        groupBy: false,
        sidePagination: 'server',
        name: 'builds',
        original: params,
        treeEnable: tree_enable,
        uniqueId: 'pk',
        rootParentId: options.parentBuild || null,
        idField: 'pk',
        parentIdField: 'parent',
        treeShowField: tree_enable ? 'reference' : null,
        showColumns: display_mode == 'list' || display_mode == 'tree',
        showCustomView: display_mode == 'calendar',
        showCustomViewButton: false,
        disablePagination: display_mode == 'calendar',
        search: display_mode != 'calendar',
        buttons: constructOrderTableButtons({
            prefix: 'build',
            callback: function() {
                // Force complete reload of the table
                loadBuildTable(table, options);
            }
        }),
        columns: [
            {
                field: 'pk',
                title: 'ID',
                visible: false,
                switchable: false,
            },
            {
                checkbox: true,
                title: '{% trans "Select" %}',
                searchable: false,
                switchable: false,
            },
            {
                field: 'reference',
                title: '{% trans "Build" %}',
                sortable: true,
                switchable: true,
                formatter: function(value, row) {

                    var html = renderLink(value, '/build/' + row.pk + '/');

                    if (row.overdue) {
                        html += makeIconBadge('fa-calendar-times icon-red', '{% trans "Build order is overdue" %}');
                    }

                    return html;
                }
            },
            {
                field: 'title',
                title: '{% trans "Description" %}',
                switchable: true,
            },
            {
                field: 'priority',
                title: '{% trans "Priority" %}',
                switchable: true,
                sortable: true,
            },
            {
                field: 'part',
                title: '{% trans "Part" %}',
                sortable: true,
                sortName: 'part__name',
                formatter: function(value, row) {

                    var html = imageHoverIcon(row.part_detail.thumbnail);

                    html += renderLink(row.part_detail.full_name, `/part/${row.part}/`);
                    html += makePartIcons(row.part_detail);

                    return html;
                }
            },
            {
                field: 'completed',
                title: '{% trans "Progress" %}',
                sortable: true,
                formatter: function(value, row) {
                    return makeProgressBar(
                        row.completed,
                        row.quantity,
                        {
                            // style: 'max',
                        }
                    );
                }
            },
            {
                field: 'status',
                title: '{% trans "Status" %}',
                sortable: true,
                formatter: function(value) {
                    return buildStatusDisplay(value);
                },
            },
            {
                field: 'creation_date',
                title: '{% trans "Created" %}',
                sortable: true,
                formatter: function(value) {
                    return renderDate(value);
                }
            },
            {
                field: 'issued_by',
                title: '{% trans "Issued by" %}',
                sortable: true,
                formatter: function(value, row) {
                    if (value) {
                        return row.issued_by_detail.username;
                    } else {
                        return `<i>{% trans "No user information" %}</i>`;
                    }
                }
            },
            {
                field: 'responsible',
                title: '{% trans "Responsible" %}',
                sortable: true,
                formatter: function(value, row) {
                    if (!row.responsible_detail) {
                        return '-';
                    }

                    var html = row.responsible_detail.name;

                    if (row.responsible_detail.label == '{% trans "group" %}') {
                        html += `<span class='float-right fas fa-users'></span>`;
                    } else {
                        html += `<span class='float-right fas fa-user'></span>`;
                    }

                    return html;
                }
            },
            {
                field: 'target_date',
                title: '{% trans "Target Date" %}',
                sortable: true,
                formatter: function(value) {
                    return renderDate(value);
                }
            },
            {
                field: 'completion_date',
                title: '{% trans "Completion Date" %}',
                sortable: true,
                formatter: function(value) {
                    return renderDate(value);
                }
            },
        ],
        customView: function(data) {
            return `<div id='build-order-calendar'></div>`;
        },
        onRefresh: function() {
            loadBuildTable(table, options);
        },
        onLoadSuccess: function() {

            if (tree_enable) {
                $(table).treegrid({
                    treeColumn: 1,
                });

                $(table).treegrid('expandAll');
            } else if (display_mode == 'calendar') {

                if (!loaded_calendar) {
                    loaded_calendar = true;

                    let el = document.getElementById('build-order-calendar');

                    calendar = new FullCalendar.Calendar(el, {
                        initialView: 'dayGridMonth',
                        nowIndicator: true,
                        aspectRatio: 2.5,
                        locale: options.locale,
                        datesSet: function() {
                            buildEvents(calendar);
                        }
                    });

                    calendar.render();
                } else {
                    calendar.render();
                }
            }
        }
    });

    linkButtonsToSelection(
        table,
        [
            '#build-print-options',
        ]
    );
}


function updateAllocationTotal(id, count, required) {

    count = parseFloat(count);

    $('#allocation-total-'+id).html(count);

    var el = $('#allocation-panel-' + id);
    el.removeClass('part-allocation-pass part-allocation-underallocated part-allocation-overallocated');

    if (count < required) {
        el.addClass('part-allocation-underallocated');
    } else if (count > required) {
        el.addClass('part-allocation-overallocated');
    } else {
        el.addClass('part-allocation-pass');
    }
}

function loadAllocationTable(table, part_id, part, url, required, button) {

    // Load the allocation table
    table.bootstrapTable({
        url: url,
        sortable: false,
        formatNoMatches: function() {
            return '{% trans "No parts allocated for" %} ' + part;
        },
        columns: [
            {
                field: 'stock_item_detail',
                title: '{% trans "Stock Item" %}',
                formatter: function(value) {
                    return '' + parseFloat(value.quantity) + ' x ' + value.part_name + ' @ ' + value.location_name;
                }
            },
            {
                field: 'stock_item_detail.quantity',
                title: '{% trans "Available" %}',
                formatter: function(value) {
                    return parseFloat(value);
                }
            },
            {
                field: 'quantity',
                title: '{% trans "Allocated" %}',
                formatter: function(value, row) {
                    var html = parseFloat(value);

                    var bEdit = `<button class='btn item-edit-button btn-sm' type='button' title='{% trans "Edit stock allocation" %}' url='/build/item/${row.pk}/edit/'><span class='fas fa-edit'></span></button>`;
                    var bDel = `<button class='btn item-del-button btn-sm' type='button' title='{% trans "Delete stock allocation" %}' url='/build/item/${row.pk}/delete/'><span class='fas fa-trash-alt icon-red'></span></button>`;

                    html += `
                    <div class='btn-group' style='float: right;'>
                        ${bEdit}
                        ${bDel}
                    </div>
                    `;

                    return html;
                }
            }
        ],
    });

    // Callback for 'new-item' button
    button.click(function() {
        launchModalForm(button.attr('url'), {
            success: function() {
                table.bootstrapTable('refresh');
            },
        });
    });

    table.on('load-success.bs.table', function() {
        // Extract table data
        var results = table.bootstrapTable('getData');

        var count = 0;

        for (var i = 0; i < results.length; i++) {
            count += parseFloat(results[i].quantity);
        }

        updateAllocationTotal(part_id, count, required);
    });

    // Button callbacks for editing and deleting the allocations
    table.on('click', '.item-edit-button', function() {
        var button = $(this);

        launchModalForm(button.attr('url'), {
            success: function() {
                table.bootstrapTable('refresh');
            }
        });
    });

    table.on('click', '.item-del-button', function() {
        var button = $(this);

        launchModalForm(button.attr('url'), {
            success: function() {
                table.bootstrapTable('refresh');
            }
        });
    });
}


/*
 * Render a table of BuildItem objects, which are allocated against a particular BuildLine
 */
function renderBuildLineAllocationTable(element, build_line, options={}) {

    let output = options.output || 'untracked';
    let tableId = `allocation-table-${output}-${build_line.pk}`;

    // Construct a table element
    let html = `
    <div class='sub-table'>
        <table class='table table-condensed table-striped' id='${tableId}'></table>
    </div>`;

    element.html(html);

    let sub_table = $(`#${tableId}`);

    // Load the allocation items into the table
    sub_table.bootstrapTable({
        data: build_line.allocations,
        showHeader: false,
        columns: [
            {
                field: 'part',
                title: '{% trans "Part" %}',
                formatter: function(value, row) {
                    let html = imageHoverIcon(row.part_detail.thumbnail);
                    html += renderLink(row.part_detail.full_name, `/part/${value}/`);
                    return html;
                }
            },
            {
                field: 'quantity',
                title: '{% trans "Allocated Quantity" %}',
                formatter: function(value, row) {
                    let text = '';
                    let url = '';
                    let serial = row.serial;

                    if (row.stock_item_detail) {
                        serial = row.stock_item_detail.serial;
                    }

                    if (serial && row.quantity == 1) {
                        text = `{% trans "Serial Number" %}: ${serial}`;
                    } else {
                        text = `{% trans "Quantity" %}: ${row.quantity}`;
                        if (row.part_detail && row.part_detail.units) {
                            text += ` <small>${row.part_detail.units}</small>`;
                        }
                    }

                    var pk = row.stock_item || row.pk;

                    url = `/stock/item/${pk}/`;

                    return renderLink(text, url);
                }
            },
            {
                field: 'location',
                title: '{% trans "Location" %}',
                formatter: function(value, row) {
                    if (row.location_detail) {
                        var text = shortenString(row.location_detail.pathstring);
                        var url = `/stock/location/${row.location}/`;

                        return renderLink(text, url);
                    } else {
                        return '<i>{% trans "No location set" %}</i>';
                    }
                }
            },
            {
                field: 'actions',
                title: '',
                formatter: function(value, row) {
                    let buttons = '';
                    buttons += makeEditButton('button-allocation-edit', row.pk, '{% trans "Edit stock allocation" %}');
                    buttons += makeDeleteButton('button-allocation-delete', row.pk, '{% trans "Delete stock allocation" %}');
                    return wrapButtons(buttons);
                }
            }
        ]
    });

    // Callbacks
    $(sub_table).on('click', '.button-allocation-edit', function() {
        let pk = $(this).attr('pk');

        constructForm(`{% url "api-build-item-list" %}${pk}/`, {
            fields: {
                quantity: {},
            },
            title: '{% trans "Edit Allocation" %}',
            onSuccess: function() {
                $(options.parent_table).bootstrapTable('refresh');
            },
        });
    });

    $(sub_table).on('click', '.button-allocation-delete', function() {
        let pk = $(this).attr('pk');

        constructForm(`{% url "api-build-item-list" %}${pk}/`, {
            method: 'DELETE',
            title: '{% trans "Remove Allocation" %}',
            onSuccess: function() {
                $(options.parent_table).bootstrapTable('refresh');
            },
        });
    });
}


/*
 * Load a table of BuildLine objects associated with a Build
 *
 * @param {int} build_id - The ID of the Build object
 * @param {object} options - Options for the table
 */
function loadBuildLineTable(table, build_id, options={}) {

    let name = 'build-lines';
    let params = options.params || {};
    let output = options.output;

    params.build = build_id;

    if (output) {
        params.output = output;
        name += `-${output}`;
    } else {
        // Default to untracked parts for the build
        params.tracked = false;
    }

    let filters = loadTableFilters('buildlines', params);
    let filterTarget = options.filterTarget || '#filter-list-buildlines';

    setupFilterList('buildlines', $(table), filterTarget);
    // If data is passed directly to this function, do not request data from the server

    let table_options = {
        name: name,
        uniqueId: 'pk',
        detailView: true,
        detailFilter: function(index, row) {
            // Detail view is available if there is any allocated stock
            return row.allocated > 0;
        },
        detailFormatter: function(_index, row, element) {
            renderBuildLineAllocationTable(element, row, {
                parent_table: table,
            });
        },
        formatNoMatches: function() {
            return '{% trans "No build lines found" %}';
        },
        columns: [
            {
                checkbox: true,
                title: '{% trans "Select" %}',
                searchable: false,
                switchable: false,
            },
            {
                field: 'bom_item',
                title: '{% trans "Required Part" %}',
                switchable: false,
                sortable: true,
                sortName: 'part',
                formatter: function(value, row) {
                    if (value == null) {
                        return `BOM item deleted`;
                    }

                    let html = '';

                    // Part thumbnail
                    html += imageHoverIcon(row.part_detail.thumbnail) + renderLink(row.part_detail.full_name, `/part/${row.part_detail.pk}/`);

                    let bom_item = row.bom_item_detail;

                    if (bom_item.allow_variants)

                    if (row.bom_item_detail) {
                        html += makeIconBadge('fa-sitemap', '{% trans "Variant stock allowed" %}');
                    }

                    if (row.part_detail.trackable) {
                        html += makeIconBadge('fa-directions', '{% trans "Trackable part" %}');
                    }

                    return html;
                }
            },
            {
                field: 'reference',
                title: '{% trans "Reference" %}',
                sortable: true,
                formatter: function(value, row) {
                    return row.bom_item_detail.reference;
                }
            },
            {
                field: 'consumable',
                title: '{% trans "Consumable" %}',
                sortable: true,
                switchable: true,
                formatter: function(value, row) {
                    return yesNoLabel(row.bom_item_detail.consumable);
                }
            },
            {
                field: 'optional',
                title: '{% trans "Optional" %}',
                sortable: true,
                switchable: true,
                formatter: function(value, row) {
                    return yesNoLabel(row.bom_item_detail.optional);
                }
            },
            {
                field: 'unit_quantity',
                sortable: true,
                title: '{% trans "Unit Quantity" %}',
                formatter: function(value, row) {
                    let text = row.bom_item_detail.quantity;

                    if (row.bom_item_detail.overage) {
                        text += ` <small>(+${row.bom_item_detail.overage}%)</small>`;
                    }

                    if (row.part_detail.units) {
                        text += ` <span class='badge bg-dark rounded-pill badge-right'>${row.part_detail.units}</small>`;
                    }

                    return text;
                }
            },
            {
                field: 'quantity',
                title: '{% trans "Required Quantity" %}',
                sortable: true,
            },
            {
                field: 'available',
                title: '{% trans "Available" %}',
                sortable: true,
                formatter: function(value, row) {
                    return 'TODO: available';
                }
            },
            {
                field: 'allocated',
                title: '{% trans "Allocated" %}',
                sortable: true,
                formatter: function(value, row) {
                    return makeProgressBar(row.allocated, row.quantity);
                }
            },
            {
                field: 'actions',
                title: '',
                switchable: false,
                sortable: false,
                formatter: function(value, row) {
                    let buttons = '';
                    let pk = row.pk;

                    // Consumable items do not need to be allocated
                    if (row.bom_item_detail.consumable) {
                        return `<em>{% trans "Consumable Item" %}</em>`;
                    }

                    if (row.part_detail.trackable && !options.output) {
                        // Tracked parts must be allocated to a specific build output
                        return `<em>{% trans "Tracked item" %}</em>`;
                    }

                    if (row.allocated < row.quantity) {

                        // Add a button to "build" stock for this line
                        if (row.part_detail.assembly) {
                            buttons += makeIconButton('fa-tools icon-blue', 'button-build', pk, '{% trans "Build stock" %}');
                        }

                        // Add a button to "purchase" stock for this line
                        if (row.part_detail.purchaseable) {
                            buttons += makeIconButton('fa-shopping-cart icon-blue', 'button-buy', pk, '{% trans "Order stock" %}');
                        }

                        // Add a button to "allocate" stock for this line
                        buttons += makeIconButton('fa-sign-in-alt icon-green', 'button-allocate', pk, '{% trans "Allocate stock" %}');
                    }

                    if (row.allocated > 0) {
                        buttons += makeRemoveButton('button-unallocate', pk, '{% trans "Remove stock allocation" %}');
                    }

                    return wrapButtons(buttons);
                }
            }
        ]
    };

    if (options.data) {
        Object.assign(table_options, {
            data: options.data,
            sidePagination: 'client',
            showColumns: false,
            pagination: false,
            disablePagination: true,
            search: false,
        });
    } else {
        Object.assign(table_options, {
            url: '{% url "api-build-line-list" %}',
            queryParams: filters,
            original: params,
            search: true,
            sidePagination: 'server',
            pagination: true,
            showColumns: true,
            buttons: constructExpandCollapseButtons(table),
        });
    }

    $(table).inventreeTable(table_options);

    /* Add callbacks for allocation buttons */

    // Callback to build stock
    $(table).on('click', '.button-build', function() {
        let pk = $(this).attr('pk');
        let row = $(table).bootstrapTable('getRowByUniqueId', pk);

        // Start a new "build" for this line
        newBuildOrder({
            part: row.part_detail.pk,
            parent: build_id,
            quantity: Math.max(row.quantity - row.allocated, 0),
        });
    });

    // Callback to purchase stock
    $(table).on('click', '.button-buy', function() {
        let pk = $(this).attr('pk');
        let row = $(table).bootstrapTable('getRowByUniqueId', pk);

        // TODO: Refresh table after purchase order is created
        orderParts([row.part_detail], {});
    });

    // Callback to allocate stock
    $(table).on('click', '.button-allocate', function() {
        let pk = $(this).attr('pk');
        let row = $(table).bootstrapTable('getRowByUniqueId', pk);

        allocateStockToBuild(build_id, [row], {
            output: options.output,
            success: function() {
                $(table).bootstrapTable('refresh');
            }
        });
    });

    // Callback to un-allocate stock
    $(table).on('click', '.button-unallocate', function() {
        let pk = $(this).attr('pk');

        deallocateStock(build_id, {
            build_line: pk,
            onSuccess: function() {
                $(table).bootstrapTable('refresh');
            }
        });
    });
}

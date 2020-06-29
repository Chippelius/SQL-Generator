(function() {


    //removes all whitespace
    let clean = x => x.replace(/\s+/g, '');

    function parseAttribute(description) {
        let attribute = Object.create(null);
        let firstBracket = description.indexOf('[');
        if (firstBracket >= 0) {
            let lastBracket = description.lastIndexOf(']');
            if (lastBracket < 0)
                throw Error(`Missing closing bracket for opening bracket:\n${description}`);
            attribute.referencesTable = description.substring(firstBracket + 1, lastBracket);
            description = description.substring(0, firstBracket) +
                description.substring(lastBracket + 1, description.length);
        }
        if (description.charAt(0) == '_' && description.charAt(description.length - 1) == '_') {
            attribute.keyCandidate = true;
            description = description.substring(1, description.length - 1);
        }
        attribute.name = description;
        return attribute;
    }

    function parseTable(description) {
        let firstBracket = description.indexOf('(');
        if (firstBracket < 0) throw Error(`Missing opening bracket in line:\n${description}`);
        else if (firstBracket < 1) throw Error(`Missing table name in line:\n${description}`);
        let lastBracket = description.lastIndexOf(')');
        if (lastBracket < 0) throw Error(`Missing closing bracket in line:\n${description}`);

        let table = Object.create(null);
        table.attributes = description.substring(firstBracket + 1, lastBracket).split(',').map(parseAttribute);
        table.primaryKey = table.attributes.filter(x => x.keyCandidate)[0];
        if (!table.primaryKey) throw Error(`Missing primaryKey for table at:\n${description}`);
        table.name = description.substring(0, firstBracket);
        return table;
    }

    function parseSchema(description) {
        let schema = description.split('\n').map(clean).filter(x => x.length > 0).map(parseTable);
        schema.forEach(table => table.attributes.forEach(attribute => {
            if (attribute.referencesTable) {
                attribute.referencesTable =
                    schema.filter(table2 => table2.name == attribute.referencesTable)[0];
                if (!attribute.referencesTable)
                    throw Error(`Table referenced by ${table.name}.${attribute.name}` +
                        ' not found.');
            }
        }));
        return schema;
    }


    let querySpecification = {
        select: ['*']
    }

    let JOIN_TYPES = ['JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN'];

    function RandomSelectQuery(schema, options) {
        let availableAttributes = [];

        this.from = [];
        let aliases = Object.create(null);
        schema.forEach(table => aliases[table.name] = 1);
        let numTables =
            Math.floor(Math.random() * (options.maxTables + 1 - options.minTables)) + options.minTables;
        for (let i = 0; i < numTables; ++i) {
            let tableRef = {
                table: schema[Math.floor(Math.random() * schema.length)]
            };
            tableRef.alias = tableRef.table.name.toString().substr(0, 2);
            if (aliases[tableRef.alias]) tableRef.alias += ++aliases[tableRef.alias];
            else aliases[tableRef.alias] = 1;

            if (i > 0) {
                let referencePairs = [];
                tableRef.table.attributes.forEach(x => {
                    if (x.referencesTable)
                        availableAttributes.forEach(y => {
                            if (x.referencesTable == y.tableRef.table && y.tableRef.table.primaryKey == y.attribute)
                                referencePairs.push({
                                    x: x,
                                    y: y
                                });
                        })
                });
                if (referencePairs.length > 0 && Math.random() < 0.8) {
                    tableRef.join = JOIN_TYPES[Math.floor(Math.random() * JOIN_TYPES.length)];
                    let refPair = referencePairs[Math.floor(Math.random() * referencePairs.length)];
                    tableRef.on = `${tableRef.alias}.${refPair.x.name} = ${refPair.y.tableRef.alias}.${refPair.y.attribute.name}`
                }
            }

            this.from.push(tableRef);
            tableRef.table.attributes.forEach(x => availableAttributes.push({
                attribute: x,
                tableRef: tableRef
            }));
        }



        this.select = ['*'];

        this.toString = function() {
            console.log(this.from);
            return 'SELECT ' + this.select.join(', ') + '\n' +
                'FROM ' + this.from.reduce(((x, y) => (x ? x + (y.join ? `\n\t${y.join} ` : ', \n\t') : '') + y.table.name + ' ' + y.alias + (y.on ? ` ON (${y.on})` : '')), null) + '\n' +
                (this.where ? 'WHERE ' + this.whereWhere + '\n' : '') +
                (this.groupBy ? 'GROUP BY ' + this.groupBy.join(', ') + '\n' : '') +
                (this.havingClause ? 'HAVING ' + this.havingClause + '\n' : '') +
                (this.orderBy ? 'ORDER BY ' + this.orderBy + '\n' : '');
        }
    }




    let selectSchema = document.getElementById('select-schema');
    let selectResult = document.getElementById('select-result');

    function fetchSelectOptions() {
        let options = Object.create(null);
        options.minTables = 1;
        options.maxTables = 5;
        return options;
    }

    window.generateSelect = function() {
        //try {
        let schema = parseSchema(selectSchema.value);
        let options = fetchSelectOptions();
        let query = new RandomSelectQuery(schema, options);
        selectResult.value = query;
        // } catch (e) {
        //     alert(e);
        // }
    }
})();

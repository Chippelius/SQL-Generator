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


    let JOIN_TYPES = ['JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN'];

    function randomNumericExpression(attributes) {
        if (!attributes || attributes.length < 1) {
            return Math.floor(Math.random() * 100) / 10;
        } else if (Math.random() < 0.8) {
            let attribute = attributes[Math.floor(Math.random() * attributes.length)];
            return `${attribute}`;
        } else if (Math.random() < 0.7) {
            return '(' + randomNumericExpression(attributes) + ') * (' +
                randomNumericExpression(attributes.filter(x => Math.random() < 0.1)) + ')';
        } else {
            return '(' + randomNumericExpression(attributes) + ') + (' +
                randomNumericExpression(attributes.filter(x => Math.random() < 0.1)) + ')';
        }
    }

    function randomBooleanExpression(attributes) {
        switch (Math.floor(Math.random() * 13)) {
            case 0:
            case 1:
                return randomNumericExpression(attributes) + ' = ' + randomNumericExpression(attributes);
            case 2:
                return randomNumericExpression(attributes) + ' < ' + randomNumericExpression(attributes);
            case 3:
                return randomNumericExpression(attributes) + ' > ' + randomNumericExpression(attributes);
            case 4:
                return randomNumericExpression(attributes) + ' <= ' + randomNumericExpression(attributes);
            case 5:
                return randomNumericExpression(attributes) + ' >= ' + randomNumericExpression(attributes);
            case 6:
            case 7:
                return 'NOT (' + randomBooleanExpression(attributes) + ')';
            case 8:
            case 9:
                return '(' + randomBooleanExpression(attributes) + ') AND (' + randomBooleanExpression(attributes) + ')';
            case 10:
            case 11:
                return '(' + randomBooleanExpression(attributes) + ') OR (' + randomBooleanExpression(attributes) + ')';
            case 12:
                let attribute = attributes[Math.floor(Math.random() * attributes.length)];
                return `${attribute} IS NULL`;
        }
    }

    function randomAggregation(attribute) {
        switch (Math.floor(Math.random() * 5)) {
            case 0:
                return `MIN(${attribute})`;
            case 1:
                return `MAX(${attribute})`;
            case 2:
                return `AVG(${attribute})`;
            case 3:
                return `SUM(${attribute})`;
            default:
                return `COUNT(${attribute})`;
        }
    }

    function RandomSelectQuery(schema, options) {
        let availableAttributes = [];

        //=== FROM ===
        this.from = [];
        let aliases = Object.create(null);
        schema.forEach(table => aliases[table.name] = 1);
        let numTables =
            Math.floor(Math.random() * (options.maxTables + 1 - options.minTables)) + options.minTables;
        for (let i = 0; i < numTables; ++i) {
            table = schema[Math.floor(Math.random() * schema.length)];
            let alias = table.name.toString().substr(0, 2);
            if (aliases[alias]) alias += ++aliases[alias];
            else aliases[alias] = 1;
            // JOIN
            let join = null,
                on = null;
            if (i > 0) { //only allow JOINs starting at the second table
                let references = availableAttributes.filter(x => x.referencesTable == table);
                if (references.length > 0 && Math.random() < 0.8) {
                    join = JOIN_TYPES[Math.floor(Math.random() * JOIN_TYPES.length)];
                    let ref = references[Math.floor(Math.random() * references.length)];
                    on = `${ref.name} = ${alias}.${table.primaryKey.name}`;
                }
            }
            this.from.push({
                name: table.name,
                alias: alias,
                join: join,
                on: on
            });
            table.attributes.forEach(x => availableAttributes.push({
                name: `${alias}.${x.name}`,
                referencesTable: x.referencesTable,
                keyCandidate: x.keyCandidate
            }));
        }

        //=== WHERE ===
        if (Math.random() < 0.5)
            this.where = randomBooleanExpression(availableAttributes.filter(x => !x.referencesTable && !x.keyCandidate).map(x => x.name));

        //=== SELECT ===
        this.select = [];
        if (Math.random() < 0.8) {
            let numericAttributes = availableAttributes.filter(x => !x.referencesTable && !x.keyCandidate);
            let numColumns = Math.floor(Math.random() * (options.maxColumns + 1 - options.minColumns)) + options.minColumns;
            for (let i = 0; i < numColumns; ++i) {
                let attribute = availableAttributes[Math.floor(Math.random() * availableAttributes.length)];
                let column = attribute.name;
                if (!attribute.referencesTable && !attribute.keyCandidate) {
                    if (Math.random() < 0.1) {
                        column = randomAggregation(column);
                    } else if (Math.random() < 0.1) {
                        column = randomAggregation(randomNumericExpression([column]));
                    }
                    if (Math.random() < 0.3) {
                        let attribute2 = numericAttributes[Math.floor(Math.random() * numericAttributes.length)];
                        if (Math.random() < 0.5) {
                            column = randomNumericExpression([column, attribute2.name]);
                        } else {
                            column = randomAggregation(randomNumericExpression([column, attribute2.name]));
                        }
                    }
                    if (Math.random() < 0.1) {
                        column = randomNumericExpression([column]);
                    } else if (Math.random() < 0.1) {
                        column = randomBooleanExpression([column]);
                    } else if (Math.random() < 0.3) {
                        let attribute2 = numericAttributes[Math.floor(Math.random() * numericAttributes.length)];
                        if (Math.random() < 0.9) {
                            column = randomNumericExpression([column, attribute2.name]);
                        } else {
                            column = randomBooleanExpression([column, attribute2.name]);
                        }
                    }
                }
                this.select.push(column);
            }
        }

        this.toString = function() {
            return 'SELECT ' + (this.select.length < 1 ? '*' : this.select.join(', ')) + '\n' +
                'FROM ' + this.from.reduce(((x, y) => (x ? x + (y.join ? `\n\t${y.join} ` : ', \n\t') : '') + y.name + ' ' + y.alias + (y.on ? ` ON (${y.on})` : '')), null) + '\n' +
                (this.where ? 'WHERE ' + this.where + '\n' : '') +
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
        options.minColumns = 2;
        options.maxColumns = 8;
        return options;
    }

    window.generateSelect = function() {
        try {
            let schema = parseSchema(selectSchema.value);
            let options = fetchSelectOptions();
            let query = new RandomSelectQuery(schema, options);
            selectResult.value = query;
        } catch (e) {
            alert(e);
        }
    }
})();

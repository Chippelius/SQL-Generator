(function() {


    let identifiable = {
        identifier: '',
        toString: function() {
            return this.identifier;
        }
    }

    //removes all whitespace
    let clean = x => x.replace(/\s+/g, '');

    function parseAttribute(description) {
        let attribute = Object.create(identifiable);
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
        attribute.identifier = description;
        return attribute;
    }

    function parseTable(description) {
        let firstBracket = description.indexOf('(');
        if (firstBracket < 0) throw Error(`Missing opening bracket in line:\n${description}`);
        else if (firstBracket < 1) throw Error(`Missing table name in line:\n${description}`);
        let lastBracket = description.lastIndexOf(')');
        if (lastBracket < 0) throw Error(`Missing closing bracket in line:\n${description}`);

        let table = Object.create(identifiable);
        table.attributes = description.substring(firstBracket + 1, lastBracket).split(',').map(parseAttribute);
        table.primaryKey = table.attributes.filter(x => x.keyCandidate)[0];
        if (!table.primaryKey) throw Error(`Missing primaryKey for table at:\n${description}`);
        table.identifier = description.substring(0, firstBracket);
        return table;
    }

    function parseSchema(description) {
        let schema = description.split('\n').map(clean).filter(x => x.length > 0).map(parseTable);
        schema.forEach(table => table.attributes.forEach(attribute => {
            if (attribute.referencesTable) {
                attribute.referencesTable =
                    schema.filter(table2 => table2.identifier == attribute.referencesTable)[0];
                if (!attribute.referencesTable)
                    throw Error(`Table referenced by ${table.identifier}.${attribute.identifier}` +
                        ' not found.');
            }
        }));
        return schema;
    }


    let querySpecification = {
        select: ['*'],
        from: [],
        where: null,
        gropBy: null,
        having: null,
        orderBy: null,
        toString: function() {
            return 'SELECT ' + this.select.join(', ') + '\n' +
                'FROM ' + this.from.join(', \n\t') + '\n' +
                (this.where ? 'WHERE ' + this.whereWhere + '\n' : '') +
                (this.groupBy ? 'GROUP BY ' + this.groupBy.join(', ') + '\n' : '') +
                (this.havingClause ? 'HAVING ' + this.havingClause + '\n' : '') +
                (this.orderBy ? 'ORDER BY ' + this.orderBy + '\n' : '');
        }
    }

    function generateSelectQuery(schema, options) {
        let query = Object.create(querySpecification);

        query.availableAttributes = [];
        query.from = [];
        query.aliases = Object.create(null);
        schema.forEach(table => query.aliases[table.identifier] = 1);
        let numTables =
            Math.floor(Math.random() * (options.maxTables + 1 - options.minTables)) + options.minTables;
        for (let i = 0; i < numTables; ++i) {
            let table = Object.create(schema[Math.floor(Math.random() * schema.length)]);
            table.alias = table.toString().substr(0, 2);
            if (query.aliases[table.alias]) table.alias += ++query.aliases[table.alias];
            else query.aliases[table.alias] = 1;
            table.toString = function() {
                return this.identifier + ' ' + this.alias
            };
            query.from.push(table);
        }

        return query;
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
        try {
            let schema = parseSchema(selectSchema.value);
            let options = fetchSelectOptions();
            let query = generateSelectQuery(schema, options);
            selectResult.value = query;
        } catch (e) {
            alert(e);
        }
    }
})();

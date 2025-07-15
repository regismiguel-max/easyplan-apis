import { Op, WhereOptions, literal } from 'sequelize';

export function sequelizeWhereToSQL(where: WhereOptions): string {
    console.log('vejaaa: ', where);
    
    const hasStringKeys = Object.keys(where).length > 0;
    const hasSymbolKeys = Object.getOwnPropertySymbols(where).length > 0;
    if (!where || typeof where !== 'object' || (!hasStringKeys && !hasSymbolKeys)) return '1=1';

    const conditions: string[] = [];

    // ✅ 1. Trata operadores de nível raiz com Symbol: Op.and, Op.or
    const rootSymbols = Object.getOwnPropertySymbols(where);
    console.log('rootSymbols: ', rootSymbols);
    
    for (const symbol of rootSymbols) {
        console.log('symbols: ', symbol);
        const val = (where as any)[symbol];
        console.log('val: ', val);

        if (symbol === Op.and || symbol === Op.or) {
            const logicList = val as any[];

            const subConditions = logicList.map((item) => {
                console.log('Vamos vê dentro do map cada item: ', item);
                
                if (item && typeof item === 'object' && item.constructor?.name === 'Literal' && 'val' in item) {
                    console.log('Vamos vê se entrou? EEEEENNNTTTRRRROOOOUUU');
                    
                    return item.val;
                }

                return sequelizeWhereToSQL(item); // recursivo
            }).filter(Boolean);

            const joined = subConditions.join(` ${symbol === Op.and ? 'AND' : 'OR'} `);
            if (joined) conditions.push(`(${joined})`);
        }
    }

    // ✅ 2. Trata chaves normais (strings), como "idade", "operadora"
    for (const [key, value] of Object.entries(where)) {
        if (value && typeof value === 'object') {
            const symbols = Object.getOwnPropertySymbols(value);

            for (const symbol of symbols) {
                const opVal = value[symbol];

                switch (symbol) {
                    case Op.in:
                        conditions.push(`${key} IN (${opVal.map((v: any) => `'${v}'`).join(', ')})`);
                        break;

                    case Op.between:
                        const [start, end] = opVal as [any, any];
                        conditions.push(`${key} BETWEEN '${start}' AND '${end}'`);
                        break;

                    case Op.like:
                        conditions.push(`${key} LIKE '${opVal}'`);
                        break;

                    case Op.gte:
                        conditions.push(`${key} >= '${opVal}'`);
                        break;

                    case Op.eq:
                        conditions.push(`${key} = '${opVal}'`);
                        break;

                    default:
                        conditions.push(`${key} = '${opVal}'`);
                        break;
                }
            }
        } else if (value && typeof value === 'object' && '_isSequelizeMethod' in value && value._isSequelizeMethod) {
            // Ex: { nome: literal(...) }
            conditions.push(value.val);
        } else {
            // Valor direto: { status: 'ATIVO' }
            conditions.push(`${key} = '${value}'`);
        }
    }

    return conditions.join(' AND ') || '1=1';
}

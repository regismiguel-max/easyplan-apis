const { where, Op, Sequelize } = require("sequelize");
const { raw } = require("body-parser");
const db = require("../../../../../../models");
const Corretora = db.corretoras;

const utils = require("./utils");

const IncentiveRepository = require("./repositories/incentivos.repository");
const { validateIncentivePayload } = require("./validators/incentive-validators");
const corretoraModel = require("../../../../../../models/corretoras/corretora.model");
const PlaniumPropostaService = require("./services/planium-propostas.service");

const { digital: api } = require("../../../config/axios/axios.config");
const { Parser } = require("json2csv");

class IncentiveController {

    async save(req, res) {
        try {
        const payload = req.body;

        console.log('Entrou na controller: ', payload);
        
        const { valid, message } = validateIncentivePayload(payload);
        if (!valid) return res.status(400).json({ sucesso: false, message });
        console.log('Passou na validação');

        let incentive = await db.incentives.findOne({
            where: {user_id: payload.user_id, status: 'Em andamento', cnpj: payload.cnpjCorretora},
            order: [['createdAt', 'DESC']],
        })

        console.log('Vamos vê se encontramos algum incentivo: ', incentive);
        // start_challenge_date: '2025-09-01T15:11:02.784-03:00',
        // "startDate": "2025-08-01T15:11:55.414-03:00",
        
        if(incentive) {
            incentive = incentive.get({plain: true});
            let current = incentive.start_challenge_date.split('T')[0];
            let last = payload.startDate.split('T')[0];

            console.log('Quais as datas: ', current, last);
            
            if(current === last){
                console.log('Tentou criar um incentivo que já está em andamento');
                
                return res.status(409).json({
                    sucesso: false,
                    message: "Já existe um incentivo em andamento para essa corretora neste mês.",
                });
            }

            console.log('Criou um desafio retroativo ou futuro');
        }

        const IncentiveRepositoryInstance = new IncentiveRepository();
        const result = await IncentiveRepositoryInstance.save(payload);
        console.log('Persistido: ', result);
        
        return res.status(201).json({
            sucesso: true,
            message: "Incentivo criado com sucesso.",
            data: result.incentive,
        });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao criar incentivo.",
            });
        }
    }

    async getAll(req, res) {
        try {
            console.log('Entrou na controller');
            const user_id = req.query.user_id;
            
            if (!user_id) return res.status(400).json({ sucesso: false, message: 'Não foi encontrado nenhum user_id nos parâmetros da requisição' });
            console.log('Passou na validação');

            let incentives;
            if(user_id === 'admin'){
                incentives = await db.incentives.findAll({
                    include: {model: db.corretoras, as: 'corretora'},
                    order: [['createdAt', 'DESC']],
                })
            } else {
                incentives = await db.incentives.findAll({
                    where: {user_id},
                    include: {model: db.corretoras, as: 'corretora'},
                    order: [['createdAt', 'DESC']],
                })
            }
            
            
            console.log('Incentivos Encontrados: ', incentives);
            
            return res.status(201).json({
                sucesso: true,
                message: "Incentivos encontrados com sucesso.",
                data: incentives,
            });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao buscar incentivos.",
            });
        }
    }

    async getById(req, res) {
        try {
            // const user_id = req.query.user_id;
            const incentive_id = req.query.incentive_id;
            
            if (!incentive_id) return res.status(400).json({ sucesso: false, message: 'Não foi encontrado nenhum user_id ou identificador do incentivo nos parâmetros da requisição' });
            console.log('Passou na validação: ', incentive_id);
            
            const incentive = await db.incentives.findByPk(incentive_id, {
                include: [
                    {model: db.corretoras, as: 'corretora'},
                    {model: db.incentives_propostas, as: 'propostas'},
                    {model: db.incentives_results, as: 'result'}
                ]
            })
            console.log('Persistido: ', incentive);
            
            return res.status(201).json({
                sucesso: true,
                message: "Incentivo encontrado com sucesso.",
                data: incentive,
            });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao criar incentivo.",
            });
        }
    }
    
    async update(req, res) {
        try {
            
            const payload = req.body;
            console.log('Entrou na controller: ', payload);
            // const user_id = req.query.user_id;
            const user_id = req.query.user_id;
            if (!user_id) return res.status(400).json({ sucesso: false, message: 'Não foi encontrado nenhum user_id ou identificador do incentivo nos parâmetros da requisição' });
            
            const { valid, message } = validateIncentivePayload(payload);
            if (!valid) return res.status(400).json({ sucesso: false, message });
            console.log('Passou na validação');
            
            const IncentiveRepositoryInstance = new IncentiveRepository();
            const result = await IncentiveRepositoryInstance.update(payload, user_id);
            console.log('Atualizado', result);
            
            return res.status(201).json({
                sucesso: true,
                message: "Incentivo atualizado com sucesso.",
            });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao atualizar incentivo.",
            });
        }
    }
    
    async delete(req, res) {
        try {
            const incentive_id = req.query.incentive_id;

            if (!incentive_id) return res.status(400).json({ sucesso: false, message: 'Não foi encontrado nenhum identificador do incentivo nos parâmetros da requisição' });
            console.log('Passou na validação');

            const deleteResult = await db.incentives.destroy({
                where: {id: incentive_id}
            })
            console.log('Persistido ', deleteResult);
            
            return res.status(201).json({
                sucesso: true,
                message: "Incentivo deletado com sucesso.",
                // data: deleteResult,
            });
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao criar incentivo.",
            });
        }
    }

    async getAllCorretorasByName(req, res) {
        try {
        const corretoraName = req.query.corretoraName;
        console.log(corretoraName);

        if (!corretoraName || typeof corretoraName !== "string") {
            return res
            .status(400)
            .json({
                error:
                "Parâmetro corretoraName é obrigatório e deve ser uma string.",
            });
        }

        const corretoras = await Corretora.findAll({
            where: {
            razao_social: {
                [Op.like]: `%${corretoraName}%`,
            },
            },
            raw: true,
        });
        console.log(corretoras);

        if (corretoras.length === 0) {
            return res
            .status(200)
            .json({ message: "Nenhuma corretora encontrada com esse nome." });
        }

        return res.status(200).json({
            corretoras: corretoras,
        });
        } catch (error) {
        return res
            .status(500)
            .json({ message: "Erro ao buscar corretoras.", erro: error });
        }
    }

    async getSales(req, res) {
        const planiumPayload = req.body;
        console.log('Chegou na controller: ', planiumPayload);

        const apiPleniumService = new PlaniumPropostaService();

        await apiPleniumService.getPropostas(planiumPayload);

        const incentive = await db.incentives.findOne({
            where: {id: planiumPayload.id},
            include: [
                {model: db.corretoras, as: 'corretora'},
                {model: db.incentives_propostas, as: 'propostas'},
                {model: db.incentives_results, as: 'result'}
            ]
        })

        return res.status(201).json({
            sucesso: true,
            message: 'Atualize a página',
            data: incentive
        })
    }

    async getUltimaProposta(req, res) {
        try {
            // const user_id = req.query.user_id;
            const incentive_id = req.query.incentive_id;
            
            if (!incentive_id) return res.status(400).json({ sucesso: false, message: 'Não foi encontrado nenhum user_id ou identificador do incentivo nos parâmetros da requisição' });
            console.log('Passou na validação: ', incentive_id);
            
            const propostaDataCriacao = await db.incentives_propostas.findOne({
                where: {incentive_id},
                order: [['data_criacao', 'DESC']],
                attributes: [ 'data_criacao' ]
            })
            console.log('Olha o retorno: ', propostaDataCriacao);
            
            if(propostaDataCriacao){
                return res.status(201).json({
                    sucesso: true,
                    message: "Tem dado",
                    data: propostaDataCriacao,
                });
            } else {
                return res.status(201).json({
                    sucesso: true,
                    message: "Não tem dado",
                });
            }
        } catch (error) {
            return res.status(500).json({
                sucesso: false,
                message: error.message || "Erro inesperado ao criar incentivo.",
            });
        }
    }

    async getFaturaPaga(req, res) {
        const incentive_id = req.query.incentive_id;

        // console.log('Caiu no server e com o id certin: ', incentive_id);
        //Pegar todos os CPF das vendas relacionadas ao Desafio em questão
        const propostasDB = await db.incentives_propostas.findAll({
            where: {incentive_id}
        });

        // console.log('Validar o retorno de propostas: ', propostasDB);
        
        const propostas = propostasDB.map(proposta => proposta.get({plain: true}))

        // Realizar a query no nosso banco Buscando o codigo_do_contrato na tabela de Beneficiário através do CPF
        let codigos_cpfs = [];
        for(let proposta of propostas){
            const codigoDB = await db.beneficiariosDigital.findOne({
                where: {numero_da_proposta: proposta.propostaID},
                attributes: ['codigo_do_contrato']
            });

            if(!codigoDB){
                console.log('Null');
                
                continue;
            }
            const codigo = codigoDB.get({plain: true});

            codigos_cpfs.push(
                {
                    cpf: proposta.contratante_cpf,
                    codigo
                }
            );
        }

        // console.log('Vejamos como ficou o final de tudo: ', codigos_cpfs);
        
        let beneficiariosPagou = []
        // Realizar a query no Digital Saúde por Fatura paga através do codigo_do_contrato do Beneficiário
        for(let codigo_cpf of codigos_cpfs){
            const codigo = codigo_cpf.codigo.codigo_do_contrato;

            try {
                const response = await api.get(`/fatura/procurarLiquidadasPorContrato?codigoContrato=${codigo}`);

                console.log('Vamos vê a resposta da Digital Saúde: ', response.data);
                // console.log('Vamos vê a resposta da Digital Saúde: ', response.data[0]);
                // console.log('Vejamos os beneficiarios: ', response.data[0]?.beneficiario);
                // console.log('Vejamos o status: ', response.data[0]?.statusFatura);
    
                if(response?.data?.length < 0) {
                    continue
                }

                if(response?.data?.length > 1){
                    for(let parcela of response.data) {
                        if(parcela.numero === 1){
                            console.log('Tem mais de uma parcela');
                            
                            beneficiariosPagou.push(
                                {
                                    pagou: true,
                                    codigo: codigo,
                                    dataPagamento: parcela.dataPagamento,
                                    contratante_cpf: codigo_cpf.cpf
                                }
                            )
                        }
                    }

                    continue
                }
    
                beneficiariosPagou.push(
                    {
                        pagou: true,
                        codigo: codigo,
                        dataPagamento: response.data[0].dataPagamento,
                        contratante_cpf: codigo_cpf.cpf
                    }
                )
            } catch (error) {
                if (error.response?.status === 400) {
                    console.error(`Erro 400 para o código do contrato ${codigo}: Requisição inválida.`);
                    continue; // Continua para o próximo item do loop
                }

                console.error(`Ocorreu um erro na requisição para o código ${codigo}:`, error);
            }
    
        }

        // Persistir as informações necessárias no banco de propostas
        // console.log('Veja a lista de quem pagou: ', beneficiariosPagou);
        let responseFrontEnd = []
        for(let beneficiarioPagou of beneficiariosPagou){
            const [response] = await db.incentives_propostas.update(
                {
                    pagou: beneficiarioPagou.pagou,
                    codigo_do_contrato: beneficiarioPagou.codigo,
                    data_pagamento: beneficiarioPagou.dataPagamento
                },
                {
                    where: {contratante_cpf: beneficiarioPagou.contratante_cpf}
                }
            );

            response > 0 ? responseFrontEnd.push('atualizado') : console.log('Error. Por algum motivo nenhuma linha foi alterada');
        }

        if(beneficiariosPagou.length !== responseFrontEnd.length){
            console.log('Erro de atualização');   
        }

        const incentive = await db.incentives.findOne({
            where: {id: incentive_id},
            include: [
                {model: db.corretoras, as: 'corretora'},
                {model: db.incentives_propostas, as: 'propostas'},
                {model: db.incentives_results, as: 'result'}
            ]
        })

        return res.status(201).json({
            sucesso: true,
            message: "Operação concluida com sucesso - atualize a página para trazer os novos dados",
            data: incentive,
        });
        
    }

    async payment(req, res){
        // console.log('Veja o que chegou: ', req);
        const incentive_id = req.query.incentive_id;

        const incentivosDB = await db.incentives_propostas.findAll({
            where: {
                pagou: true,
                financeiro_pagou: false,
                incentive_id
            },
            include: {model: db.incentives, as: 'incentivo'}
        });

        const incentivos = incentivosDB.map(incentivo => incentivo.get({plain: true}));

        // Quantidade de Propostas
        const quantidadePropostas = incentivos.length
        // Quantidade de Vidas
        const quantidadeBeneficiarios = incentivos.reduce((soma, item) => soma + item.beneficiarios, 0);
        // Total a pagar n x vidas
        const totalPagar = quantidadeBeneficiarios * incentivos[0].incentivo.payment_life;
        // Informações do Recebedor
        const nomeRecebedor = incentivos[0].incentivo.broker_name;
        const cpfRecebedor = incentivos[0].incentivo.broker_cpf;

        const payload = {
            quantidadePropostas,
            quantidadeBeneficiarios,
            totalPagar,
            nomeRecebedor,
            cpfRecebedor
        }

        console.log('Veja o payload Final: ', payload);

        return res.status(201).json({
            sucesso: true,
            message: 'Lista encontrada com sucesso',
            data: payload
        })
    }

    async paymentList(req, res){
        // console.log('Veja o que chegou: ', req);
        const incentive_id = req.query.incentive_id;

        const incentivosDB = await db.incentives_propostas.findAll({
            where: {
                pagou: true,
                financeiro_pagou: false,
                incentive_id
            },
            include: {model: db.incentives, as: 'incentivo'}
        });

        const incentivos = incentivosDB.map(incentivo => incentivo.get({plain: true}));

        // Campos que você deseja exportar
        // const fields = ['contratante_nome', 'operadora', 'data_pagamento', 'data_vigencia', 'financeiro_pagou']; 
        const fields = [
            { label: 'Financeiro Pagou', value: 'financeiro_pagou' },
            { label: 'Nome do Contratante', value: 'contratante_nome' },
            { label: 'Data Pagamento', value: 'data_pagamento' },
            { label: 'Data Vigencia', value: row => row.data_vigencia ? new Date(row.data_vigencia).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '' },
            { label: 'Operadora', value: 'operadora' },
            { label: 'Nome do Recebedor', value: 'incentivo.broker_name' },
            { label: 'CPF do Recebedor', value: 'incentivo.broker_cpf' },
            { label: 'Quantidade Beneficiário', value: 'beneficiarios' },
        ];

        const opts = {fields, delimiter: ';', quote: ''}
        const json2csvParser = new Parser(opts);
        const csv = json2csvParser.parse(incentivos);

        res.header('Content-Type', 'text/csv');
        res.attachment('pagamentos.csv');
        return res.send(csv);

        // return res.status(201).json({
        //     sucesso: true,
        //     message: 'Lista encontrada com sucesso',
        //     data: incentivos
        // })
    }

    async paymentListByPaymentDate(req, res){
        // console.log('Veja o que chegou: ', req);
        const paymentDate = JSON.parse(req.query.paymentDate);
        console.log('Veja o que veio: ', paymentDate);
        console.log('Veja o que veio: ', paymentDate.init);
        

        const incentivosDB = await db.incentives_propostas.findAll({
            where: {
                pagou: true,
                financeiro_pagou: false,
                [Op.and]: [
                    Sequelize.where(
                        Sequelize.fn("STR_TO_DATE", Sequelize.col("data_pagamento"), "%d/%m/%Y"),
                        { [Op.gte]: Sequelize.fn("STR_TO_DATE", paymentDate.init, "%d/%m/%Y") }
                    ),
                    Sequelize.where(
                        Sequelize.fn("STR_TO_DATE", Sequelize.col("data_pagamento"), "%d/%m/%Y"),
                        { [Op.lte]: Sequelize.fn("STR_TO_DATE", paymentDate.end, "%d/%m/%Y") }
                    )
                ]
            },
            include: {model: db.incentives, as: 'incentivo'}
        });

        const incentivos = incentivosDB.map(incentivo => incentivo.get({plain: true}));

        // Campos que você deseja exportar
        // const fields = ['contratante_nome', 'operadora', 'data_pagamento', 'data_vigencia', 'financeiro_pagou']; 
        const fields = [
            // { label: 'Financeiro Pagou', value: 'financeiro_pagou' },
            { label: 'Nome do Contratante', value: 'contratante_nome' },
            { label: 'Mes do Desafio', value: row => `${utils(row.incentivo.end_challenge_date.split('T')[0])}` },
            { label: 'CPF do titular', value: row => `'${row.contratante_cpf}` },
            { label: 'Data Pagamento', value: 'data_pagamento' },
            { label: 'Data Vigencia', value: row => row.data_vigencia ? new Date(row.data_vigencia).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '' },
            { label: 'Operadora', value: 'operadora' },
            { label: 'Nome do Recebedor', value: 'incentivo.broker_name' },
            { label: 'CPF do Recebedor', value: row => `'${row.incentivo.broker_cpf}` },
            { label: 'Quantidade Beneficiário', value: 'beneficiarios' },
            { label: 'Nome Corretora', value: 'corretora_nome' },
            { label: 'Valor por Vida', value: 'incentivo.payment_life' },
            { label: 'Meta de vida', value: 'incentivo.life_goal' },
        ];

        const opts = {fields, delimiter: ';', quote: ''}
        const json2csvParser = new Parser(opts);
        const csv = json2csvParser.parse(incentivos);

        // res.header('Content-Type', 'text/csv');
        // res.attachment('pagamentos.csv');
        // return res.send(csv);

        const propostas = incentivos.reduce((acc, proposta) => {
            const { corretora_nome, beneficiarios, incentivo, } = proposta;
            console.log(proposta);
            const nomeCorretora = corretora_nome + incentivo.end_challenge_date.split('T')[0];
            
            // inicializa a corretora se ainda não existir
            if (!acc[nomeCorretora]) {
                acc[nomeCorretora] = {
                    corretora_nome,
                    totalPropostas: 0,
                    totalBeneficiarios: 0,
                    valorTotal: 0,
                    dataDesafio: '',
                    valorVidas: 0,
                    metaVidas: 0
                    // propostas: [] // opcional, se quiser listar as propostas
                };
            }

            // atualiza os dados
            acc[nomeCorretora].totalPropostas += 1;
            acc[nomeCorretora].totalBeneficiarios += beneficiarios;
            acc[nomeCorretora].valorTotal += beneficiarios * incentivo.payment_life;
            acc[nomeCorretora].valorVidas = incentivo.payment_life;
            acc[nomeCorretora].metaVidas = incentivo.life_goal;
            acc[nomeCorretora].dataDesafio = incentivo.end_challenge_date.split('T')[0];

            return acc;
        }, {});

        // propostas.forEach(proposta => {
        //     proposta.totalBeneficiarios * 
        // })
        const propostasAgrupadas = Object.values(propostas);
        // console.log('Propostas agrupadas e em array: ', propostas);

        return res.status(201).json({
            sucesso: true,
            message: 'Lista encontrada com sucesso',
            data: propostasAgrupadas,
            csv: Buffer.from(csv).toString('base64')
        })
    }

    async report(req, res){
        const incentive_id = req.query.incentive_id;
        console.log('Veja o que chegou: ', incentive_id);

        const incentivosDB = await db.incentives_propostas.findAll({
            where: {
                incentive_id
            },
            include: {model: db.incentives, as: 'incentivo'}
        });

        const incentivos = incentivosDB.map(incentivo => incentivo.get({plain: true}));

        // Campos que você deseja exportar
        // const fields = ['contratante_nome', 'operadora', 'data_pagamento', 'data_vigencia', 'financeiro_pagou']; 
        const fields = [
            { label: 'Produto', value: 'produto' },
            { label: 'Status da Proposta', value: 'status' },
            { label: 'Data Vigencia', value: row => row.data_assinatura ? new Date(row.data_assinatura).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '' },
            { label: 'Data Vigencia', value: row => row.data_criacao ? new Date(row.data_criacao).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '' },
            { label: 'CPF do Corretor', value: 'vendedor_cpf' },
            { label: 'Nome do Corretor', value: 'vendedor_nome' },
            { label: 'CNPJ Corretora', value: 'corretora_cnpj' },
            { label: 'Nome Corretora', value: 'corretora_nome' },
            { label: 'Contratante E-mail', value: 'contratante_email' },
            { label: 'Contratante Nome', value: 'contratante_nome' },
            { label: 'UF', value: 'uf' },
            { label: 'Valor Total', value: 'total_valor' },
            { label: 'ID da Proposta', value: 'propostaID' },
            { label: 'Contratante CPF', value: 'contrante_cpf' },
            { label: '1° Parcela paga?', value: 'pagou' },
            { label: 'Codigo do Contrato', value: 'codigo_do_ontrato' },
            { label: 'Quantidade de Beneficiários', value: 'beneficiarios' },
            { label: '1° Parcela paga?', value: 'pagou' },
            { label: 'Financeiro Pagou', value: 'financeiro_pagou' },
            { label: 'Nome do Contratante', value: 'contratante_nome' },
            { label: 'Data Pagamento', value: 'data_pagamento' },
            { label: 'Data Vigencia', value: row => row.data_vigencia ? new Date(row.data_vigencia).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '' },
            { label: 'Operadora', value: 'operadora' },
            { label: 'Nome do Recebedor', value: 'incentivo.broker_name' },
            { label: 'CPF do Recebedor', value: 'incentivo.broker_cpf' },
        ];

        const opts = {fields, delimiter: ';', quote: ''}
        const json2csvParser = new Parser(opts);
        const csv = json2csvParser.parse(incentivos);

        res.header('Content-Type', 'text/csv');
        res.attachment('pagamentos.csv');
        return res.send(csv);

        // return res.status(201).json({
        //     sucesso: true,
        //     message: 'Lista encontrada com sucesso',
        //     data: incentivos
        // })
    }
}

module.exports = new IncentiveController();

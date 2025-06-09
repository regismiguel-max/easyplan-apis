const xlsx = require('node-xlsx');
const axios = require('axios');
const oauth = require('axios-oauth-client');

exports.verifyCPF = async (req, res) => {
    let i = 1;
    let cpfs = [];
    let access_token = ''
    let plan;
    let ress;

    ress = res;
    const filePath = `${req.file.destination}${req.file.filename}`;
    plan = await xlsx.parse(filePath);
    const getClientCredentials = oauth.clientCredentials(
        axios.create(),
        `https://rhsso.paas.cassi.com.br/auth/realms/Colaborador/protocol/openid-connect/token`,
        '18987107000130',
        '199e9aa0-e030-4be6-bf11-5913641190bd',
        'write read'
    )

    getClientCredentials()
        .then(async (response) => {
            if (response) {
                access_token = response.access_token
                this.getVerify(i, cpfs, access_token, plan, ress);
            }
            else {
                res.status(401).send({
                    message: "Erro ao gerar o token, tente novamente!",
                    sucesso: true
                });
            }
        })
        .catch((err) => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            });
        });
};

exports.getVerify = async (i, cpfs, access_token, plan, ress) => {
    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://convenio.api.paas.cassi.com.br/api/v2/cartao/listarCartaoReciprocidade?cpfs=${plan[0].data[i][2]}`,
        headers: {
            'user_key': 'ab528b045541388f54f6f0c3733f272c',
            'Authorization': `Bearer ${access_token}`,
        }
    };
    axios.request(config)
        .then((resp) => {
            if (i === plan[0].data.length - 1) {
                ress.send({
                    cpfs: cpfs,
                    message: "cpfs sem retorno da carteirinha!",
                    sucesso: true
                });
            }
            else {
                i++;
                this.getVerify(i, cpfs, access_token, plan, ress);
            }
        })
        .catch((err) => {
            if (err.response.status === 400) {
                if (err.response.data.mensagens[0] === 'Não foram encontrados registros para os dados informados.') {
                    if (err.response.data.data === null) {
                        cpfs.push(
                            {
                                nome: plan[0].data[i][1],
                                documento: String(plan[0].data[i][2]),
                                matricula: plan[0].data[i][49] ? plan[0].data[i][49] : ''
                            }
                        )
                        if (i === plan[0].data.length - 1) {
                            ress.send({
                                cpfs: cpfs,
                                message: "cpfs sem retorno da carteirinha!",
                                sucesso: true
                            });
                        }
                        else {
                            i++;
                            this.getVerify(i, cpfs, access_token, plan, ress);
                        }
                    }
                }
            }
            else {
                ress.status(500).send({
                    message: err.message,
                    sucesso: false
                });
            }
        });

}

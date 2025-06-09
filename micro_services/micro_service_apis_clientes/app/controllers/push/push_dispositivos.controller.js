const db = require("../../../../../models");
const User = db.user_client;
const PushDispositivos = db.push_dispositivos;
const { where, Op } = require("sequelize");

exports.pushDispositivos = async (req, res) => {
    try {
        const {
            user_document,
            player_id,
            device_uuid,
            device_platform,
            is_logged_in,
            last_push_sent
        } = req.body;

        let user_id = null;

        // Tenta buscar user_id pelo documento SOMENTE se is_logged_in === true
        if (is_logged_in && user_document) {
            const cpf = user_document.replace(/\D/g, '');
            const usuarioExistente = await User.findOne({ where: { cpf } });
            if (usuarioExistente) {
                user_id = usuarioExistente.id;
            }
        }

        // Tenta encontrar o dispositivo pelo identificador único (player_id + uuid)
        const dispositivoExistente = await PushDispositivos.findOne({
            where: {
                player_id,
                device_uuid
            }
        });

        const dadosParaSalvar = {
            user_id: is_logged_in ? user_id : null, // remove vínculo no logout
            is_logged_in,
            device_platform
        };

        if (last_push_sent) {
            dadosParaSalvar.last_push_sent = last_push_sent;
        }

        if (dispositivoExistente) {
            // Atualiza sempre o user_id e demais campos
            await dispositivoExistente.update(dadosParaSalvar);

            return res.send({
                message: 'Dispositivo atualizado com sucesso!',
                sucesso: true
            });
        } else {
            // Cria novo dispositivo
            await PushDispositivos.create({
                player_id,
                device_uuid,
                ...dadosParaSalvar
            });

            return res.send({
                message: 'Dispositivo cadastrado com sucesso!',
                sucesso: true
            });
        }

    } catch (error) {
        console.error('Erro ao registrar dispositivo:', error);
        return res.status(500).send({
            message: error.message || 'Erro interno do servidor.',
            sucesso: false
        });
    }
};
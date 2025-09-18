const cron = require("node-cron");
const db = require("../../../../../../../models");

const { Op, where } = require("sequelize");

function todayDateOnly() {
  return new Date(new Date().toISOString().split("T")[0]);
}

cron.schedule('* 12 * * *', async () => {
  const today = todayDateOnly();

  console.log(`[CRON] Rodando atualização de incentivos em ${today.toISOString().split('T')[0]}`);

  try {
    // Atualizar status dos desafios
    await db.incentives.update(
      { status: 'Em breve' },
      {
        where: db.sequelize.where(
          db.sequelize.fn('DATE', db.sequelize.col('start_challenge_date')),
          { [Op.gt]: today }
        )
      }
    );

    await db.incentives.update(
      { status: 'Em andamento' },
      {
        where: {
          [Op.and]: [
            db.sequelize.where(
              db.sequelize.fn('DATE', db.sequelize.col('start_challenge_date')),
              { [Op.lte]: today }
            ),
            db.sequelize.where(
              db.sequelize.fn('DATE', db.sequelize.col('end_challenge_date')),
              { [Op.gte]: today }
            )
          ]
        }
      }
    );

    await db.incentives.update(
      { status: 'Encerrado' },
      {
        where: db.sequelize.where(
          db.sequelize.fn('DATE', db.sequelize.col('end_challenge_date')),
          { [Op.lt]: today }
        )
      }
    );

    // Calcular resultado para desafios encerrados e sem resultado ainda
    const encerradosDB = await db.incentives.findAll({
      where: {
        status: 'Encerrado',
        resultado_desafio: { [Op.is]: null } // só os que ainda não têm resultado
      },
      include: [
        {
          model: db.incentives_results,
          as: 'result', // alias do relacionamento
          attributes: ['total_lifes']
        }
      ]
    });

    const encerrados = encerradosDB.map((proposta) => proposta.get({ plain: true }));
    console.log('Retorno de encerrados: ', encerrados);
    

    for (const incentivo of encerrados) {
      const meta = parseInt(incentivo.life_goal || 0, 10);
      const vendas = parseInt(incentivo.result?.total_lifes || 0, 10);

      let resultado = 'Não atingiu';
      if (vendas >= meta) {
        resultado = 'Atingiu';
      }

      const [affectedRows] = await db.incentives.update(
        { resultado_desafio: resultado },
        {
          where: {id: incentivo.id}
        }
      );
      console.log(`[CRON] Resultado do desafio ${incentivo.id} atualizado para: ${resultado}`);
    }

    console.log('[CRON] Rotina concluída com sucesso.');
  } catch (error) {
    console.error('[CRON] Erro na atualização de incentivos:', error);
  }
});
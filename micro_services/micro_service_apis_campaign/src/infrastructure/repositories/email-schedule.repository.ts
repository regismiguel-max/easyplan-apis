import IEmailScheduleRepository from "../../application/repositories-interfaces/email-schedule.repository";
import EmailScheduleModel from "../database/models/filters/schedules.models";

export class EmailCampaignScheduleRepository
  implements IEmailScheduleRepository
{
  async save(
    email_campaign_id: number,
    data: {
      dateSchedule: string;
      periodicity: string;
    }
  ): Promise<void> {
    const scheduleDB = await EmailScheduleModel.create({
      scheduleDate: new Date(data.dateSchedule),
      periodicity: data.periodicity,
      emailCampaignId: email_campaign_id,
    });
    const pureObject = scheduleDB.get({ plain: true });
    return pureObject;
  }

  async update(
    emailCampaignId: number,
    data: { dateSchedule: string; periodicity: string }
  ) {
    const existing = await EmailScheduleModel.count({
      where: { emailCampaignId },
    });

    if (existing === 0) return "pode salvar";

    const scheduleUpdateDB = await EmailScheduleModel.update(
      {
        scheduleDate: new Date(data.dateSchedule),
        periodicity: data.periodicity,
      },
      {
        where: { emailCampaignId },
      }
    );

    if (scheduleUpdateDB.length <= 0)
      throw new Error(
        "Schedule update - Erro - Nenhuma linha foi atualizada do banco de dados"
      );

    return `schedule - Atualização realizada com sucesso. ${scheduleUpdateDB.length} linhas foram atualizadas.`;
  }

  async deleteByCampaignId(emailCampaignId: number): Promise<void> {
    console.log("Entrou dentro do deletar agendamento");
    const existSchedule = await EmailScheduleModel.count({where: { emailCampaignId }});

    if (existSchedule === 0) {
      ("");
    } else {
      console.log("Deletar schedule");

      const deleteResult = await EmailScheduleModel.destroy({ where: { emailCampaignId }});

      if (deleteResult <= 0) throw new Error("Erro - Nenhuma linha foi deletada do banco de dados");

      console.log("Schedule - Deletado com sucesso e quantidade de linhas deletada: ", deleteResult);
    }
  }
}

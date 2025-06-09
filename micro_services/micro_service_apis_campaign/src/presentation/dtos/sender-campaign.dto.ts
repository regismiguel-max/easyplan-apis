// import { IsNotEmpty } from "class-validator";
// import EmailCampaignEntity from "../../domain/entities/EmailCampaign";

// export default class SenderCampaignDTO {
//     @IsNotEmpty({ message: "Os dados da campanha são obrigatórios" })
//     public dataCampaign: EmailCampaignEntity;

//     @IsNotEmpty({ message: "O canal da campanha é obrigatório" })
//     public channel: string;

//     @IsNotEmpty({ message: "O de dados do Template da campanha é obrigatório" })
//     public emailTemplateData: any;

//     constructor(data: SenderCampaignDTO) {
//         this.dataCampaign = data.dataCampaign;
//         this.channel = data.channel;
//         this.emailTemplateData = data.emailTemplateData;

//         if (!data.dataCampaign.emailTemplateId) {
//             throw new Error("EmailTemplateId é obrigatório para enviar uma campanha");
//         }
//     }
// }
import { Request, Response } from 'express';
import SendCampaignUseCase from '../../application/usecases/send-campaign/sender-campaign.usecase';
import WebHookSendGrid from '../../application/usecases/send-campaign/webHook-sendGrid.usecase';
// import SenderCampaignDTO from '../dtos/sender-campaign.dto';
import { validate } from 'class-validator';
import CRUDCampaignDTO from '../dtos/crud-campaign.dto';


export default class SendEmailCampaignController {
    constructor(
        private sendCampaignUseCase?: SendCampaignUseCase,
        private webHookUseCase?: WebHookSendGrid,
    ) {}

    public async sendEmail(req: Request, res: Response) {
        try {
            const payload = req.body;

            const dto = new CRUDCampaignDTO(payload);

            const errors = await validate(dto);
            
            if (errors.length > 0) res.status(400).json({ errors: errors.map(e => e.constraints) });

            const result = await this.sendCampaignUseCase?.execute(dto);
    
            res.status(201).json({
                status: 201,
                success: true,
                message: result,
                data: dto.campaignBaseInformations.id
            });

            return;
        } catch (error) {
            console.log('O erro é o seguinte: ', error);
            console.log(error);    
            res.status(400).json({
                status: 400,
                success: false,
                message: error,
                // data: dto.dataCampaign.id
            });
            return;
        }
    }

    public async webHookStatistics(req: Request, res: Response) {
        res.status(200).send('Webhook recebido');

        console.log('Entrou na controller do Envio de E-mail - Método WebHookStatistics - Requisição -> ', req.body);
        
        const eventStatistics = Array.isArray(req.body) ? req.body : [req.body];

        this.webHookUseCase?.handleWebHook(eventStatistics);
    }
}
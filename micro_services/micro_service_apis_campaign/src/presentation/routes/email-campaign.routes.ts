import express, { Request, Response } from 'express';
import EmailCampaignRepository from '../../infrastructure/repositories/email-campaign.repository';
import SaveEmailCampaignUseCase from '../../application/usecases/email-campaign/save.usecase';
import EmailCampaignController from '../controllers/email-campaign.controller';
import EmailTemplateRepository from '../../infrastructure/repositories/email-template.repository';
import SaveEmailTemplateUseCase from '../../application/usecases/email-campaign/save-email-template.usecase';
import GetAllEmailCampaignsUseCase from '../../application/usecases/email-campaign/get-all.usecase';
import GetEmailCampaignUseCase from '../../application/usecases/email-campaign/get.usecase';
import EditEmailCampaignUseCase from '../../application/usecases/email-campaign/edit.usecase';
import DeleteEmailCampaignUseCase from '../../application/usecases/email-campaign/delete.usecase';
import SendCampaignUseCase from '../../application/usecases/send-campaign/sender-campaign.usecase';
import SendEmailCampaignController from '../controllers/send-email-campaign.controller';
import WebHookSendGrid from '../../application/usecases/send-campaign/webHook-sendGrid.usecase';
import { CKEditorUploadImageMiddleware } from '../middleware/ckeditor-upload-image';
import EmailFiltersRepository from '../../infrastructure/repositories/email-filters.repository';
import { EmailCampaignScheduleRepository } from '../../infrastructure/repositories/email-schedule.repository';
import EditTemplateUseCase from '../../application/usecases/email-campaign/template-edit.usecase';
import { FilterService } from '../../application/services/filter.service';
import FilterStrategyFactory from '../../application/strategies/filter-strategy.factory';
import StatisticsEmailCampaignRepository from '../../infrastructure/repositories/statistics-email-campaign.repository';

const router = express.Router();

const emailCampaignRepository = new EmailCampaignRepository();
const emailFiltersRepository = new EmailFiltersRepository();//emailFiltersRepository,
const emailScheduleRepository = new EmailCampaignScheduleRepository();
const filterStrategyFactory = new FilterStrategyFactory(emailFiltersRepository);
const filterService = new FilterService(filterStrategyFactory);
const saveEmailCampaignUseCase = new SaveEmailCampaignUseCase(emailCampaignRepository, emailScheduleRepository, filterService);
const emailCampaignController = new EmailCampaignController(saveEmailCampaignUseCase, undefined, undefined, undefined, undefined, undefined, undefined);
router.post('/save', emailCampaignController.save.bind(emailCampaignController));

const emailCampaignRepository2 = new EmailCampaignRepository();
const emailTemplateRepository = new EmailTemplateRepository();
const assignEmailTemplateUseCase = new SaveEmailTemplateUseCase(emailCampaignRepository2, emailTemplateRepository);
const emailCampaignController2 = new EmailCampaignController(undefined, assignEmailTemplateUseCase, undefined, undefined, undefined, undefined);
router.post('/saveTemplate', emailCampaignController2.saveTemplate.bind(emailCampaignController2));

const emailCampaignRepository3 = new EmailCampaignRepository();
const getAllEmailCampaignsUseCase = new GetAllEmailCampaignsUseCase(emailCampaignRepository3);
const emailCampaignController3 = new EmailCampaignController(undefined, undefined, getAllEmailCampaignsUseCase, undefined, undefined, undefined);
router.get('/campaigns', emailCampaignController3.getAll.bind(emailCampaignController3));

const emailCampaignRepository4 = new EmailCampaignRepository();
const getEmailCampaignsUseCase = new GetEmailCampaignUseCase(emailCampaignRepository4);
const emailCampaignController4 = new EmailCampaignController(undefined, undefined, undefined, getEmailCampaignsUseCase, undefined, undefined);
router.get('/campaign/:id', emailCampaignController4.getEmailCampaign.bind(emailCampaignController4));

const emailCampaignRepository6 = new EmailCampaignRepository();
const emailFiltersRepository2 = new EmailFiltersRepository();
const filterStrategyFactory2 = new FilterStrategyFactory(emailFiltersRepository2);
const filterService2 = new FilterService(filterStrategyFactory2);
// const emailScheduleRepository2 = new EmailCampaignScheduleRepository();
const editEmailCampaignUseCase = new EditEmailCampaignUseCase(emailCampaignRepository6, filterService2);
const emailCampaignController6 = new EmailCampaignController(undefined, undefined, undefined, undefined, editEmailCampaignUseCase, undefined);
router.put('/edit', emailCampaignController6.edit.bind(emailCampaignController6));

const emailCampaignRepository7 = new EmailCampaignRepository();
const emailFiltersRepository3 = new EmailFiltersRepository();
const emailScheduleRepository3 = new EmailCampaignScheduleRepository();
const emailStatistics = new StatisticsEmailCampaignRepository()
const deleteEmailCampaignUseCase = new DeleteEmailCampaignUseCase(emailCampaignRepository7, emailFiltersRepository3, emailScheduleRepository3);
const emailCampaignController7 = new EmailCampaignController(undefined, undefined, undefined, undefined, undefined, deleteEmailCampaignUseCase);
router.delete('/delete', emailCampaignController7.delete.bind(emailCampaignController7));


const emailTemplateRepository5 = new EmailTemplateRepository();
const emailCampaignRepository00 = new EmailCampaignRepository();
const statisticsRepository = new StatisticsEmailCampaignRepository();
const sendCampaignUseCase = new SendCampaignUseCase(emailTemplateRepository5, emailCampaignRepository00, statisticsRepository);
const sendEmailController = new SendEmailCampaignController(sendCampaignUseCase);
router.post('/sendCampaign', sendEmailController.sendEmail.bind(sendEmailController));

const emailCampaignRepository8 = new EmailCampaignRepository();
const webHookUseCase = new WebHookSendGrid(emailCampaignRepository8);
const sendEmailController2 = new SendEmailCampaignController(undefined, webHookUseCase);
router.post('/statistic', sendEmailController2.webHookStatistics.bind(sendEmailController2));

const emailTemplateRepository6 = new EmailTemplateRepository();
const editTemplateUseCase = new EditTemplateUseCase(emailTemplateRepository6)
const emailCampaignController8 = new EmailCampaignController(undefined, undefined, undefined, undefined, undefined, undefined, undefined, editTemplateUseCase);
router.put('/editTemplate', emailCampaignController8.editTemplate.bind(emailCampaignController8))

router.get('/:id/status', async (req: Request, res: Response) => {
    const id = Number(req.params);
    const emailCampaignRepository = new EmailCampaignRepository();
    const campaign = await emailCampaignRepository.findById(id);
    if (!campaign) {
        res.status(404).json({ status: 404, success: false, message: 'Campanha não encontrada' });
        return;
    }
  
    res.status(200).json({
        status: 200,
        success: true,
        message: 'Campanha encontrada',
        data: campaign
    });
    return;
});

const upload = CKEditorUploadImageMiddleware.getMulterInstance();
router.post('/upload/image', upload.single('upload'), (req: Request, res: Response) => {
    try {
        if (!req.file) {
           res.status(400).json({ error: { message: 'Arquivo inválido ou não enviado.' } });
           return;
        }
    
        const protocol = req.protocol;
        const host = req.get('host');
        const filePath = `public/ckeditor/image/${req.file.filename}`;
        const fileUrl = `${protocol}://${host}/${filePath}`;
    
        res.status(200).json({
          uploaded: 1,
          url: fileUrl,
          fileName: req.file.filename
        });
        return;
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: { message: 'Erro no upload da imagem.' } });
        return;
    }
})

// router.get('/public', express.static('../../../public'));

export default router;

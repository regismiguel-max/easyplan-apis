import express, { Request, Response } from 'express';
import CampaignRepository from '../../infrastructure/repositories/campaign.repository';
import SaveCampaignUseCase from '../../application/usecases/save-campaign.usecase';
import CampaignController from '../controllers/campaign.controller';
import TemplateRepository from '../../infrastructure/repositories/template.repository';
import SaveTemplateUseCase from '../../application/usecases/save-template.usecase';
import GetCampaignUseCase from '../../application/usecases/get.usecase';
import DeleteCampaignUseCase from '../../application/usecases/delete.usecase';
import SendCampaignUseCase from '../../application/usecases/send-campaign/sender-campaign.usecase';
import SendEmailCampaignController from '../controllers/send-email-campaign.controller';
import WebHookSendGrid from '../../application/usecases/send-campaign/webHook-sendGrid.usecase';
import { CKEditorUploadImageMiddleware } from '../middleware/ckeditor-upload-image';
import FiltersRepository from '../../infrastructure/repositories/filters.repository';
import { EmailCampaignScheduleRepository } from '../../infrastructure/repositories/email-schedule.repository';
import EditTemplateUseCase from '../../application/usecases/edit-template.usecase';
import { FilterService } from '../../application/services/filter.service';
import FilterStrategyFactory from '../../application/strategies/filter-strategy.factory';
import StatisticsEmailCampaignRepository from '../../infrastructure/repositories/statistics-email-campaign.repository';
import RecipientGroupRepository from '../../infrastructure/repositories/recipient-group.repository';
import EditCampaignUseCase from '../../application/usecases/edit-campaign.usecase';
import GetAllCampaignsUseCase from '../../application/usecases/get-all.usecase';
import StatisticsWhatsCampaignRepository from '../../infrastructure/repositories/statistics-whats-campaign.repository';

const router = express.Router();

const campaignRepository = new CampaignRepository();
const filtersRepository = new FiltersRepository();//filtersRepository,
const recipientGroupRepository = new RecipientGroupRepository();
const filterStrategyFactory = new FilterStrategyFactory(filtersRepository);
const filterService = new FilterService(filterStrategyFactory);
const emailStatisticsRepository9 = new StatisticsEmailCampaignRepository();
const whatsStatisticsRepository9 = new StatisticsWhatsCampaignRepository();
const saveCampaignUseCase = new SaveCampaignUseCase(campaignRepository, recipientGroupRepository, filtersRepository, filterService, emailStatisticsRepository9, whatsStatisticsRepository9);
const campaignController = new CampaignController(saveCampaignUseCase, undefined, undefined, undefined, undefined, undefined, undefined);
router.post('/save', campaignController.save.bind(campaignController));

const campaignRepository2 = new CampaignRepository();
const templateRepository = new TemplateRepository();
const saveTemplateUseCase = new SaveTemplateUseCase(campaignRepository2, templateRepository);
const campaignController2 = new CampaignController(undefined, saveTemplateUseCase, undefined, undefined, undefined, undefined);
router.post('/saveTemplate', campaignController2.saveTemplate.bind(campaignController2));

const campaignRepository3 = new CampaignRepository();
const getAllCampaignsUseCase = new GetAllCampaignsUseCase(campaignRepository3);
const campaignController3 = new CampaignController(undefined, undefined, getAllCampaignsUseCase, undefined, undefined, undefined);
router.get('/campaigns', campaignController3.getAll.bind(campaignController3));

const campaignRepository4 = new CampaignRepository();
const getCampaignsUseCase = new GetCampaignUseCase(campaignRepository4);
const campaignController4 = new CampaignController(undefined, undefined, undefined, getCampaignsUseCase, undefined, undefined);
router.get('/campaign/:id', campaignController4.getEmailCampaign.bind(campaignController4));

const campaignRepository6 = new CampaignRepository();
const filtersRepository2 = new FiltersRepository();
const filterStrategyFactory2 = new FilterStrategyFactory(filtersRepository2);
const filterService2 = new FilterService(filterStrategyFactory2);
// const emailScheduleRepository2 = new EmailCampaignScheduleRepository();
const recipientGroupRepository1 = new RecipientGroupRepository();
const filtersRepository8 = new FiltersRepository();//filtersRepository,
const emailStatisticsRepositoryEdit = new StatisticsEmailCampaignRepository();
const whatsStatisticsRepositoryEdit = new StatisticsWhatsCampaignRepository();
const editCampaignUseCase = new EditCampaignUseCase(campaignRepository6, recipientGroupRepository1, filtersRepository8, filterService2, emailStatisticsRepositoryEdit, whatsStatisticsRepositoryEdit);
const campaignController6 = new CampaignController(undefined, undefined, undefined, undefined, editCampaignUseCase, undefined);
router.put('/edit', campaignController6.edit.bind(campaignController6));

const campaignRepository7 = new CampaignRepository();
const filtersRepository3 = new FiltersRepository();
const emailScheduleRepository3 = new EmailCampaignScheduleRepository();
const emailStatistics = new StatisticsEmailCampaignRepository()
const recipientGroupRepository2 = new RecipientGroupRepository();
const whatsStatisticsRepository2 = new StatisticsWhatsCampaignRepository();
const deleteCampaignUseCase = new DeleteCampaignUseCase(campaignRepository7, filtersRepository3, recipientGroupRepository2, emailScheduleRepository3, emailStatistics, whatsStatisticsRepository2);
const campaignController7 = new CampaignController(undefined, undefined, undefined, undefined, undefined, deleteCampaignUseCase);
router.delete('/delete', campaignController7.delete.bind(campaignController7));


const templateRepository5 = new TemplateRepository();
const campaignRepository00 = new CampaignRepository();
const statisticsRepository = new StatisticsEmailCampaignRepository();
const whatsStatisticsRepository = new StatisticsWhatsCampaignRepository();
const recipientGroupRepository3 = new RecipientGroupRepository();
const sendCampaignUseCase = new SendCampaignUseCase(templateRepository5, campaignRepository00, statisticsRepository, whatsStatisticsRepository, recipientGroupRepository3);
const sendEmailController = new SendEmailCampaignController(sendCampaignUseCase);
router.post('/sendCampaign', sendEmailController.sendEmail.bind(sendEmailController));

const campaignRepository8 = new CampaignRepository();
const webHookUseCase = new WebHookSendGrid(campaignRepository8);
const sendEmailController2 = new SendEmailCampaignController(undefined, webHookUseCase);
router.post('/statistic', sendEmailController2.webHookStatistics.bind(sendEmailController2));

const templateRepository6 = new TemplateRepository();
const editTemplateUseCase = new EditTemplateUseCase(templateRepository6);
const campaignController8 = new CampaignController(undefined, undefined, undefined, undefined, undefined, undefined, undefined, editTemplateUseCase);
router.put('/editTemplate', campaignController8.editTemplate.bind(campaignController8));

const templateRepository7 = new TemplateRepository();
const campaignController9 = new CampaignController(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, templateRepository7);
router.get('/templates', campaignController9.getAllTemplates.bind(campaignController9));

router.get('/:id/status', async (req: Request, res: Response) => {
    const id = Number(req.params);
    const campaignRepository = new CampaignRepository();
    const campaign = await campaignRepository.findById(id);
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

router.post('/statistics/whatsapp', (req: Request, res: Response) => {
    console.log('Kauliz statistics', req);
})

// router.get('/public', express.static('../../../public'));

export default router;

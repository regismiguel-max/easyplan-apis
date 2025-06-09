import express from 'express';
import EmailFiltersController from '../controllers/email-filters.controller';
import EmailFiltersRepository from '../../infrastructure/repositories/email-filters.repository';
import GetOperatorsUseCase from '../../application/usecases/email-filters/get-operators.usecase';
import GetPlansUseCase from '../../application/usecases/email-filters/get-plans.usecase';
import GetContractStatusesUseCase from '../../application/usecases/email-filters/get-contract-statuses.usecase';
import GetModalitiesUseCase from '../../application/usecases/email-filters/get-modalities.usecase';
import GetUfsUseCase from '../../application/usecases/email-filters/get-ufs.usecase';

const router = express.Router();

/************************************************************  GET'S  **********************************************************************/

/********** GET - OPERATORS ***********/
const emailFiltersRepository = new EmailFiltersRepository();
const getOperatorsUseCase = new GetOperatorsUseCase(emailFiltersRepository)
const emailFiltersController = new EmailFiltersController(getOperatorsUseCase, undefined, undefined, undefined, undefined);
router.get('/operators', emailFiltersController.getOperators.bind(emailFiltersController));

/********** GET - PLANS ***********/
const emailFiltersRepository2 = new EmailFiltersRepository();
const getOperatorsUseCase2 = new GetOperatorsUseCase(emailFiltersRepository2)
const getPlansUseCase = new GetPlansUseCase(emailFiltersRepository2)
const emailFiltersController2 = new EmailFiltersController(getOperatorsUseCase2, getPlansUseCase);
router.get('/plansByOperator/:operator', emailFiltersController2.getPlansByOperator.bind(emailFiltersController2));

const emailFiltersRepository3 = new EmailFiltersRepository();
const getPlansUseCase2 = new GetPlansUseCase(emailFiltersRepository3)
const emailFiltersController3 = new EmailFiltersController(undefined, getPlansUseCase2);
router.get('/plans', emailFiltersController3.getPlans.bind(emailFiltersController3));

/********** GET - CONTRACT STATUSES ***********/
const emailFiltersRepository4 = new EmailFiltersRepository();
const getContractStatusesUseCase = new GetContractStatusesUseCase(emailFiltersRepository4)
const emailFiltersController4 = new EmailFiltersController(undefined, undefined, getContractStatusesUseCase);
router.get('/contractStatuses', emailFiltersController4.getContractStatuses.bind(emailFiltersController4));

/********** GET - MODALITIES ***********/
const emailFiltersRepository5 = new EmailFiltersRepository();
const getModalitiesUseCase = new GetModalitiesUseCase(emailFiltersRepository5)
const emailFiltersController5 = new EmailFiltersController(undefined, undefined, undefined, getModalitiesUseCase);
router.get('/modalities', emailFiltersController5.getModalities.bind(emailFiltersController5));

/********** GET - UFS ***********/
const emailFiltersRepository6 = new EmailFiltersRepository();
const getUfsUseCase = new GetUfsUseCase(emailFiltersRepository6)
const emailFiltersController6 = new EmailFiltersController(undefined, undefined, undefined, undefined, getUfsUseCase);
router.get('/ufs', emailFiltersController6.getUfs.bind(emailFiltersController6));

export default router;
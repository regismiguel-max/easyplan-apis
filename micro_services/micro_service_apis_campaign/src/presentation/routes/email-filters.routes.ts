import express from 'express';
import EmailFiltersController from '../controllers/email-filters.controller';
import FiltersRepository from '../../infrastructure/repositories/filters.repository';
import GetOperatorsUseCase from '../../application/usecases/email-filters/get-operators.usecase';
import GetPlansUseCase from '../../application/usecases/email-filters/get-plans.usecase';
import GetContractStatusesUseCase from '../../application/usecases/email-filters/get-contract-statuses.usecase';
import GetModalitiesUseCase from '../../application/usecases/email-filters/get-modalities.usecase';
import GetUfsUseCase from '../../application/usecases/email-filters/get-ufs.usecase';

const router = express.Router();

/************************************************************  GET'S  **********************************************************************/

/********** GET - OPERATORS ***********/
const filtersRepository = new FiltersRepository();
const getOperatorsUseCase = new GetOperatorsUseCase(filtersRepository)
const emailFiltersController = new EmailFiltersController(getOperatorsUseCase, undefined, undefined, undefined, undefined);
router.get('/operators', emailFiltersController.getOperators.bind(emailFiltersController));

/********** GET - PLANS ***********/
const filtersRepository2 = new FiltersRepository();
const getOperatorsUseCase2 = new GetOperatorsUseCase(filtersRepository2)
const getPlansUseCase = new GetPlansUseCase(filtersRepository2)
const emailFiltersController2 = new EmailFiltersController(getOperatorsUseCase2, getPlansUseCase);
router.get('/plansByOperator/:operator', emailFiltersController2.getPlansByOperator.bind(emailFiltersController2));

const filtersRepository3 = new FiltersRepository();
const getPlansUseCase2 = new GetPlansUseCase(filtersRepository3)
const emailFiltersController3 = new EmailFiltersController(undefined, getPlansUseCase2);
router.get('/plans', emailFiltersController3.getPlans.bind(emailFiltersController3));

/********** GET - CONTRACT STATUSES ***********/
const filtersRepository4 = new FiltersRepository();
const getContractStatusesUseCase = new GetContractStatusesUseCase(filtersRepository4)
const emailFiltersController4 = new EmailFiltersController(undefined, undefined, getContractStatusesUseCase);
router.get('/contractStatuses', emailFiltersController4.getContractStatuses.bind(emailFiltersController4));

/********** GET - MODALITIES ***********/
const filtersRepository5 = new FiltersRepository();
const getModalitiesUseCase = new GetModalitiesUseCase(filtersRepository5)
const emailFiltersController5 = new EmailFiltersController(undefined, undefined, undefined, getModalitiesUseCase);
router.get('/modalities', emailFiltersController5.getModalities.bind(emailFiltersController5));

/********** GET - UFS ***********/
const filtersRepository6 = new FiltersRepository();
const getUfsUseCase = new GetUfsUseCase(filtersRepository6)
const emailFiltersController6 = new EmailFiltersController(undefined, undefined, undefined, undefined, getUfsUseCase);
router.get('/ufs', emailFiltersController6.getUfs.bind(emailFiltersController6));

export default router;
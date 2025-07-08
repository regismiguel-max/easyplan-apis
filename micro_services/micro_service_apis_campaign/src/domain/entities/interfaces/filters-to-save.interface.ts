import BirthDTOPersistence from "./birth-dto-persistence.interface";

export default interface FiltersToSave {
    activeFiltersKey: ActiveFilterKey[];
    activeFiltersValues: ActiveFiltersValues;
}

export type ActiveFilterKey = | 'operator' | 'plan' | 'contractStatus' | 'uf' | 'ageRange' | 'birth' | 'validity' | 'gender';

export type ActiveFiltersValues = Partial<{
    operator: number[];
    plan: number[];
    contractStatus: number[];
    uf: number[];
    ageRange: [number, number];
    birth: BirthDTOPersistence;
    validity: [string, string];
    gender?: string;
}>;

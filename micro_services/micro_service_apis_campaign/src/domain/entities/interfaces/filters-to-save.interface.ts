export default interface FiltersToSave {
    activeFiltersKey: ActiveFilterKey[];
    activeFiltersValues: ActiveFiltersValues;
}

export type ActiveFilterKey = | 'operator' | 'plan' | 'contractStatus' | 'uf' | 'ageRange' | 'validity';

export type ActiveFiltersValues = Partial<{
    operator: number[];
    plan: number[];
    contractStatus: number[];
    uf: number[];
    ageRange: [number, number];
    validity: [string, string];
}>;

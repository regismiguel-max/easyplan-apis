export default interface ContractStatus {
    id: number;
    status: string;
    createdAt: Date;
    updatedAt: Date | null;
}
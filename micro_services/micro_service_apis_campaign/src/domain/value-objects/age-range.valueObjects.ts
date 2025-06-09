class AgeRange {
    constructor(
      public start: number,
      public end: number
    ) {
      if (start < 0 || end < start) throw new Error("Faixa etária inválida.");
    }
}
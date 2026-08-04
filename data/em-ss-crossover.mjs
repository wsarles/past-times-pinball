// Pinball's EM-to-SS crossover period.
//
// Outside 1975–1979, year alone is sufficient for this collection:
// through 1974 is EM; 1980 onward is SS. During the crossover,
// each year uses its most common type and only exceptions are listed.
// All numeric values below are Pinball Map machine IDs.

export const EM_THROUGH_YEAR = 1974;
export const SS_FROM_YEAR = 1980;

export const CROSSOVER_DEFAULTS = Object.freeze({
  1975: "EM",
  1976: "EM",
  1977: "EM",
  1978: "SS",
  1979: "SS",
});

export const CROSSOVER_EXCEPTIONS = new Map([
  // Solid-state exceptions during EM-default years.
  [1050, "SS"],
  [3723, "SS"],
  [778, "SS"],
  [783, "SS"],
  [786, "SS"],
  [847, "SS"],
  [900, "SS"],
  [2711, "SS"],
  [3146, "SS"],

  // Electromechanical exceptions during SS-default years.
  [1039, "EM"],
  [2386, "EM"],
  [2629, "EM"],
  [3726, "EM"],
]);

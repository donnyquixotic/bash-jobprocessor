let checkIfDepsCompleted = (arr, target) => target.every(v => arr.includes(v))

describe("checker function", function() {
    it("returns flase when all elements in target array are not in comparison array", function() {
      expect(checkIfDepsCompleted([1,2], [1,2,3])).toBe(false);
    });
});


describe("checker function", function() {
    it("returns true when all elements in target array are in comparison array", function() {
      expect(checkIfDepsCompleted([1,2,3], [1,2])).toBe(true);
    });
});
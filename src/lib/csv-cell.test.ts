import assert from "node:assert/strict";
import test from "node:test";
import { csvCell } from "./csv-cell";

test("plain strings are quoted and embedded quotes doubled", () => {
  assert.equal(csvCell("Revenue"), '"Revenue"');
  assert.equal(csvCell('Say "hi"'), '"Say ""hi"""');
});

test("formula-leading strings get an apostrophe prefix", () => {
  for (const cell of ["=SUM(A1)", "+1", "-1", "@cmd", "  =1+1", "\t=1", "\r=1", "\n=1"]) {
    assert.equal(csvCell(cell), `"'${cell}"`, JSON.stringify(cell));
  }
});

test("numbers stay unquoted, negatives included", () => {
  assert.equal(csvCell(-12.5), "-12.5");
  assert.equal(csvCell(0), "0");
  assert.equal(csvCell(42), "42");
});

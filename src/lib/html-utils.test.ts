import assert from "node:assert/strict";
import test from "node:test";
import { isEmptyHtml, textToHtml } from "./html-utils";

test("membungkus teks polos jadi satu paragraf", () => {
  assert.equal(textToHtml("Halo dunia"), "<p>Halo dunia</p>");
});

test("memisah paragraf pada baris kosong, baris tunggal jadi <br>", () => {
  assert.equal(textToHtml("Satu\n\nDua"), "<p>Satu</p><p>Dua</p>");
  assert.equal(textToHtml("Satu\nDua"), "<p>Satu<br>Dua</p>");
});

test("meng-escape karakter markup supaya teks model tidak jadi tag", () => {
  // Tanpa ini, sisa kalimat setelah "<" hilang saat dirender.
  assert.equal(
    textToHtml("Nilai <b>naik</b> tajam"),
    "<p>Nilai &lt;b&gt;naik&lt;/b&gt; tajam</p>"
  );
});

test("ampersand di-escape sekali, bukan dua kali", () => {
  // Urutan penggantian penting: kalau & tidak lebih dulu, "<" berubah jadi
  // "&amp;lt;" dan pengguna melihat teks mentah itu di editor.
  assert.equal(textToHtml("A & B"), "<p>A &amp; B</p>");
  assert.equal(textToHtml("<x> & <y>"), "<p>&lt;x&gt; &amp; &lt;y&gt;</p>");
});

test("teks kosong atau hanya spasi menghasilkan string kosong, bukan <p></p>", () => {
  // <p></p> lolos dari isEmptyHtml? Tidak — tapi mengembalikan "" membuat
  // tombol Kirim tetap nonaktif tanpa bergantung pada pemeriksaan lain.
  assert.equal(textToHtml(""), "");
  assert.equal(textToHtml("   \n\n  "), "");
  assert.equal(isEmptyHtml(textToHtml("")), true);
});

import { createRequire } from "module";
import { writeFileSync } from "fs";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");

const ROWS = [
  ["EMPLOYMENT OFFER LETTER", "title"],
  ["", "sp"],
  ["Dear Candidate,", "b"],
  ["", "sp"],
  ["We are pleased to offer you the position of Software Engineer at TechCorp India Pvt Ltd.", "b"],
  ["Annual Cost to Company (CTC): INR 8,00,000 per annum. Date of Joining: October 1, 2024.", "b"],
  ["", "sp"],
  ["1. PROBATION PERIOD", "h"],
  ["You will be on probation for a period of six (6) months from your date of joining. During the probation period, either party may terminate employment by giving seven (7) days written notice.", "b"],
  ["", "sp"],
  ["2. NOTICE PERIOD", "h"],
  ["Upon confirmation of employment, either party wishing to terminate shall give sixty (60) days advance written notice. In lieu of notice, sixty (60) days gross salary shall be paid as compensation.", "b"],
  ["", "sp"],
  ["3. SERVICE BOND", "h"],
  ["As the Company will invest in your training and development, you agree to serve a minimum period of eighteen (18) months from your date of joining. Should you leave before completing eighteen (18) months, you shall pay to the Company Rupees Two Lakh only (INR 2,00,000) as liquidated damages, being a genuine pre-estimate of the loss the Company will suffer.", "b"],
  ["", "sp"],
  ["4. NON-COMPETE RESTRICTION", "h"],
  ["For twelve (12) months following the termination of your employment for any reason, you shall not be employed by, consult for, own, or manage any entity competing with TechCorp India Pvt Ltd in the software development and IT services sector in India.", "b"],
  ["", "sp"],
  ["5. INTELLECTUAL PROPERTY", "h"],
  ["All inventions, code, software, and work product created by you during employment, related to the Company business, shall vest exclusively in TechCorp India Pvt Ltd. You irrevocably assign all rights therein to the Company.", "b"],
  ["", "sp"],
  ["Sincerely, Priya Sharma, Head of Human Resources, TechCorp India Pvt Ltd", "b"],
];

function generatePDF() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 60, bottom: 60, left: 72, right: 72 } });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    for (const [text, type] of ROWS) {
      if (type === "title") doc.fontSize(16).font("Helvetica-Bold").text(text, { align: "center" }).moveDown(0.5);
      else if (type === "h") doc.fontSize(11).font("Helvetica-Bold").text(text).moveDown(0.2);
      else if (type === "b") doc.fontSize(10).font("Helvetica").text(text, { align: "justify" }).moveDown(0.3);
      else doc.moveDown(0.5);
    }
    doc.end();
  });
}

const pdf = await generatePDF();
writeFileSync("test_offer.pdf", pdf);
console.log("PDF saved to test_offer.pdf");

/**
 * Promotion Letter HTML Generator and Print Utility
 * Produces an official, A4-styled formal company promotion letter for UDF personnel.
 */

export interface PromotionLetterData {
    empName: string;
    empId: string;
    currentDesig: string;
    finalDesignation: string;
    effectiveDate: string;
    resolvedSiteName: string;
    refNumber: string;
    remarks?: string;
}

const esc = (val: unknown): string =>
    String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export function generatePromotionLetterHtml(data: PromotionLetterData): string {
    const formattedDate = new Date(data.effectiveDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Promotion Letter - ${esc(data.empName)} (${esc(data.empId)})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cinzel:wght@700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 20mm; }
    body {
      font-family: 'Inter', sans-serif;
      color: #1e293b;
      line-height: 1.6;
      margin: 0;
      padding: 24px;
      background: #fff;
    }
    .letter-container {
      max-width: 720px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      padding: 40px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    @media print {
      body { padding: 0; }
      .letter-container { border: none; padding: 0; box-shadow: none; }
      .no-print { display: none; }
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .company-name {
      font-family: 'Cinzel', serif;
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 1px;
      margin: 0;
    }
    .company-tagline {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 4px;
    }
    .company-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
    }
    .meta-bar {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 24px;
      color: #334155;
    }
    .recipient-block {
      margin-bottom: 24px;
      font-size: 13px;
    }
    .subject {
      text-align: center;
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      text-decoration: underline;
      margin: 24px 0;
      color: #0f172a;
      letter-spacing: 0.5px;
    }
    .body-text {
      font-size: 13px;
      text-align: justify;
      margin-bottom: 16px;
      color: #334155;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 12px;
    }
    .details-table th, .details-table td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      text-align: left;
    }
    .details-table th {
      background-color: #f8fafc;
      font-weight: 700;
      width: 35%;
      color: #1e293b;
    }
    .details-table td {
      font-weight: 600;
      color: #0f172a;
    }
    .sign-block {
      margin-top: 48px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .sign-unit {
      text-align: left;
      font-size: 12px;
    }
    .sign-line {
      width: 180px;
      border-top: 1px solid #94a3b8;
      margin-top: 48px;
      padding-top: 6px;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save PDF</button>
  <div class="letter-container">
    <div class="header">
      <h1 class="company-name">UNIQUE DELTA FORCE SECURITY SERVICES PVT LTD</h1>
      <p class="company-tagline">Excellence in Security, Vigilance & Facility Operations</p>
      <p class="company-sub">Regd. Off: Hitech City, Hyderabad, Telangana — 500081 | Email: hr@udfonline.in | Web: www.udfonline.in</p>
    </div>

    <div class="meta-bar">
      <span><strong>Ref:</strong> ${esc(data.refNumber)}</span>
      <span><strong>Date:</strong> ${esc(formattedDate)}</span>
    </div>

    <div class="recipient-block">
      <strong>To,</strong><br>
      <strong>${esc(data.empName)}</strong><br>
      Employee ID: <strong>${esc(data.empId)}</strong><br>
      Current Designation: ${esc(data.currentDesig)}<br>
      Deployment Location: ${esc(data.resolvedSiteName)}
    </div>

    <div class="subject">
      SUBJECT: PROMOTION ORDER — ELEVATION TO ${esc(data.finalDesignation.toUpperCase())}
    </div>

    <p class="body-text">
      Dear <strong>${esc(data.empName)}</strong>,
    </p>

    <p class="body-text">
      We are pleased to inform you that in recognition of your consistent diligence, exemplary discipline, and valuable contribution to Unique Delta Force Security Services Pvt. Ltd., the Management is delighted to promote you to the cadre of <strong>${esc(data.finalDesignation)}</strong> with effect from <strong>${esc(formattedDate)}</strong>.
    </p>

    <p class="body-text">
      In your elevated capacity, you will assume expanded operational leadership, supervision, and security responsibilities. The summary of your revised deployment details is outlined below:
    </p>

    <table class="details-table">
      <tr>
        <th>Employee Name</th>
        <td>${esc(data.empName)}</td>
      </tr>
      <tr>
        <th>Employee ID</th>
        <td>${esc(data.empId)}</td>
      </tr>
      <tr>
        <th>Previous Cadre / Designation</th>
        <td>${esc(data.currentDesig)}</td>
      </tr>
      <tr>
        <th>Elevated Cadre / Designation</th>
        <td style="color: #2563eb; font-weight: 800;">${esc(data.finalDesignation)}</td>
      </tr>
      <tr>
        <th>Effective Date</th>
        <td>${esc(formattedDate)}</td>
      </tr>
      <tr>
        <th>Posting / Operational Site</th>
        <td>${esc(data.resolvedSiteName)}</td>
      </tr>
      ${data.remarks ? `
      <tr>
        <th>Management Citation</th>
        <td>${esc(data.remarks)}</td>
      </tr>` : ''}
    </table>

    <p class="body-text">
      All other terms and conditions governing your employment with the organization shall continue to remain in full force and effect. We take this opportunity to congratulate you on your well-deserved promotion and trust that you will continue to discharge your duties with the highest standards of integrity, alertness, and professional excellence.
    </p>

    <p class="body-text" style="margin-top: 24px;">
      We wish you sustained success in your new position.
    </p>

    <div class="sign-block">
      <div class="sign-unit">
        <div class="sign-line">
          <strong>Employee Signature</strong><br>
          <span>(Acknowledgement of Acceptance)</span>
        </div>
      </div>
      <div class="sign-unit" style="text-align: right;">
        <div class="sign-line" style="margin-left: auto;">
          <strong>For Unique Delta Force Security Services Pvt. Ltd.</strong><br>
          <span style="color: #64748b;">Authorized Signatory / HR Operations</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

export function printPromotionLetter(data: PromotionLetterData): boolean {
    const printWin = window.open('', '_blank', 'width=850,height=1100');
    if (!printWin) {
        alert("Please allow popups to generate the promotion letter.");
        return false;
    }
    printWin.document.write(generatePromotionLetterHtml(data));
    printWin.document.close();
    return true;
}


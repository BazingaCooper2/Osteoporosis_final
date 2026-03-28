import styles from './page.module.css';
import Link from 'next/link';

const INTENDED_USES = [
  'Engineering evaluation of the OsteoScreen prototype pipeline',
  'Educational walkthroughs and model benchmarking with de-identified scans',
  'Research triage experiments under clinician oversight (not diagnostic)',
];

const LIMITATIONS = [
  { label: 'Image Quality Dependence', detail: 'Low-resolution, overexposed, or artefact-heavy images may produce unreliable estimates.' },
  { label: 'Distribution Shift', detail: 'Performance may degrade on scanner brands or patient populations not represented in training data.' },
  { label: 'Pediatric Use', detail: 'The model was not validated on patients under 18. Use in pediatric populations is not intended.' },
  { label: 'No Ground-Truth DXA', detail: 'T-score estimates are proxies and do not replace a clinical DXA scan.' },
  { label: 'Singular Modality', detail: 'Analysis relies solely on the upload; no clinical history, lab values, or fracture history is incorporated.' },
];

const FAILURE_MODES = [
  'Non-skeletal images (chest X-rays, knee MRIs) may produce plausible-sounding but clinically irrelevant outputs.',
  'Implants, surgical hardware, and severe osteoarthritis can confound density estimation.',
  'Very early-stage bone loss (T-score near −1.0) may be misclassified as normal.',
  'Images compressed beyond 50% JPEG quality may reduce local feature fidelity.',
];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.pageHeader}>
          <div className={styles.headerMeta}>
            <span className={styles.docType}>Model Card</span>
            <span className={styles.version}>Research prototype · Updated from main branch build</span>
          </div>
          <h1 className={styles.title}>About OsteoScreen</h1>
          <p className={styles.sub}>
            A transparent record of what this model does, how it was trained, and where it should and should not be used — in keeping with responsible AI in clinical settings.
          </p>
        </div>

        <div className={styles.layout}>
          <div className={styles.main}>
            {/* Overview */}
            <section className={styles.section} aria-labelledby="overview-title">
              <h2 id="overview-title" className={styles.cardTitle}>Model Overview</h2>
              <div className={styles.card}>
                <table className={styles.overviewTable}>
                  <tbody>
                    <tr><td>Model Name</td><td>OsteoScreen research prototype</td></tr>
                    <tr><td>Task</td><td>Image-based osteoporosis risk stratification from DXA or X-ray uploads</td></tr>
                    <tr><td>Architecture</td><td>PyTorch CNN with regression and classification heads (ResNet-style backbone)</td></tr>
                    <tr><td>Input</td><td>PNG or JPEG radiograph (≤ 20 MB; ≥ 96 DPI recommended)</td></tr>
                    <tr><td>Output</td><td>Risk label (Low/Moderate/High), confidence score, T-score proxy, BMD estimate</td></tr>
                    <tr><td>Training Snapshot</td><td>Ships with weights from Direct_Models/models_improved; raw data not included</td></tr>
                    <tr><td>Regulatory Status</td><td>Investigational use only — not cleared for clinical deployment</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Data Sources */}
            <section className={styles.section} aria-labelledby="data-title">
              <h2 id="data-title" className={styles.cardTitle}>Training Data</h2>
              <div className={styles.card}>
                <p className={styles.cardText}>
                  This repository distributes pretrained checkpoints only. They originate from internal experiments
                  on de-identified DXA-style scans, and the raw datasets are intentionally excluded. To retrain or
                  validate the model, you will need to supply your own compliant data sources.
                </p>
                <ul className={styles.dataList}>
                  <li><strong>Data availability:</strong> Model weights live under Direct_Models/models_improved; sample images are not bundled.</li>
                  <li><strong>Label source:</strong> Risk classes and T-score proxies come from the metadata used during training.</li>
                  <li><strong>Adaptation:</strong> Retraining requires institution-specific datasets that reflect your scanners and populations.</li>
                  <li><strong>Governance:</strong> Ensure any uploaded data is de-identified and approved under your local privacy process.</li>
                </ul>
                <p className={styles.cardSubnote}>
                  No PHI ships with this project. When incorporating patient data, follow your organization&apos;s IRB/ethics guidance and applicable privacy laws.
                </p>
              </div>
            </section>

            {/* Intended Use */}
            <section className={styles.section} aria-labelledby="use-title">
              <h2 id="use-title" className={styles.cardTitle}>Intended Use</h2>
              <div className={styles.card}>
                <ul className={styles.useList}>
                  {INTENDED_USES.map((u) => (
                    <li key={u}>
                      <span className={styles.checkIcon} aria-hidden="true">✓</span>
                      {u}
                    </li>
                  ))}
                </ul>
                <div className={styles.notIntended}>
                  <strong>Not intended for:</strong> Primary clinical diagnosis, pediatric patients, emergency decision-making, or use as a sole determinant of pharmacological therapy.
                </div>
              </div>
            </section>

            {/* Limitations */}
            <section className={styles.section} aria-labelledby="limit-title">
              <h2 id="limit-title" className={styles.cardTitle}>Known Limitations</h2>
              <div className={styles.limitsGrid}>
                {LIMITATIONS.map(({ label, detail }) => (
                  <div key={label} className={styles.limitCard}>
                    <p className={styles.limitLabel}>{label}</p>
                    <p className={styles.limitDetail}>{detail}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Failure Modes */}
            <section className={styles.section} aria-labelledby="failure-title">
              <h2 id="failure-title" className={styles.cardTitle}>Known Failure Modes</h2>
              <div className={styles.card}>
                <ul className={styles.failureList}>
                  {FAILURE_MODES.map((f, i) => (
                    <li key={i}>
                      <span className={styles.warnIcon} aria-hidden="true">⚠</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className={styles.sidebar} aria-label="Quick reference">
            <div className={styles.sideCard}>
              <p className={styles.sideTitle}>Key Disclaimer</p>
              <p className={styles.sideText}>
                This tool does not provide a medical diagnosis. It is not a substitute for professional
                clinical judgment. Consult a licensed healthcare provider for any medical decisions.
              </p>
            </div>
            <div className={styles.sideCard}>
              <p className={styles.sideTitle}>Reporting Errors</p>
              <p className={styles.sideText}>
                If you believe this model produced a clinically implausible result, please document
                the case and contact the portal administrator. Bug reports help improve model safety.
              </p>
            </div>
            <div className={styles.sideCard}>
              <p className={styles.sideTitle}>Quick Links</p>
              <ul className={styles.sideLinks}>
                <li><Link href="/upload">Analyze an Image</Link></li>
                <li><Link href="/insights">Clinical Insights</Link></li>
                <li><a href="https://www.iofbonehealth.org" target="_blank" rel="noopener noreferrer">IOF Bone Health</a></li>
                <li><a href="https://www.uspreventiveservicestaskforce.org" target="_blank" rel="noopener noreferrer">USPSTF Guidelines</a></li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

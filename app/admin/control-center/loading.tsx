import styles from "@/components/admin/control-center.module.css";
export default function ControlCenterLoading() {
    return <main className={styles.root} aria-busy="true"><div className={styles.wrap}><header className={styles.header}><div><p className={styles.eyebrow}>FREEARN / OPERATIONS</p><h1>Control Center</h1></div></header><p className={styles.notice} role="status">Loading financial records securely…</p></div></main>;
}

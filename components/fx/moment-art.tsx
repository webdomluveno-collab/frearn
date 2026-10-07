import { Icon } from './icon';
import { PAYOUT_RULES } from '@/lib/withdrawals';
import { TallyMark } from './tally';
import styles from './moment-art.module.css';

/** Original CSS/vector collage. Values describe the minimum, never a credited reward. */
export function MomentArt({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.art} ${compact ? styles.compact : ''}`} aria-hidden="true">
      <div className={styles.orbit} />
      <div className={styles.orbitTwo} />
      <span className={styles.spark}>✳</span>
      <span className={styles.dots}>•••</span>
      <div className={styles.ticket}>
        <div>
          <Icon name="survey" size={21} />
          <span>A LITTLE FREE TIME</span>
          <span>↗</span>
        </div>
        <strong>
          Your next
          <br />
          little win.
        </strong>
        <div className={styles.ticketLines}>
          <i />
          <i />
          <i />
        </div>
        <span>SURVEYS / OFFERS / POSSIBILITIES</span>
      </div>
      <div className={styles.coin}>
        <span>REVOLUT / PAYPAL — FROM</span>
        <strong>
          <small>$</small>
          {(PAYOUT_RULES.revolut.minimumCents / 100).toFixed(2)}
        </strong>
        <TallyMark size={36} />
      </div>
      <div className={styles.phone}>
        <div className={styles.phoneTop}>
          <TallyMark size={22} />
          <span>YOUR MOMENT</span>
        </div>
        <div className={styles.face}>
          <i />
          <i />
          <span />
        </div>
        <span>
          A little,
          <br />
          <strong>then a little more.</strong>
        </span>
        <div className={styles.phoneButton}>MAKE IT COUNT ↗</div>
      </div>
      <div className={styles.method}>
        <Icon name="wallet" size={20} />
        <span>
          Revolut <b>+</b> PayPal
        </span>
        <span>↗</span>
      </div>
      <div className={styles.caption}>SMALL START. REAL POSSIBILITIES.</div>
    </div>
  );
}

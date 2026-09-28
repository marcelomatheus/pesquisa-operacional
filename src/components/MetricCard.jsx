import { motion } from 'framer-motion';

export function MetricCard({ icon: Icon, label, value, detail, tone = 'violet', delay = 0 }) {
  return (
    <motion.article
      className={`metric-card tone-${tone}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.38 }}
    >
      <div className="metric-card__icon"><Icon size={18} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </motion.article>
  );
}

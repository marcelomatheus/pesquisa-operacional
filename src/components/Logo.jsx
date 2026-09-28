import { motion } from 'framer-motion';

export function Logo({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <motion.div
        className="brand__mark"
        animate={{ rotate: [0, 8, 0, -8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <span className="brand__orbit" />
        <span className="brand__pivot" />
      </motion.div>
      {!compact && (
        <div>
          <strong>PivôNauta</strong>
          <small>Simplex Studio</small>
        </div>
      )}
    </div>
  );
}

import { r2 } from './money.js';

export const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
};

/**
 * Validate GSTIN structure: 2-digit state code + PAN (10 chars) + entity num (1) + Z + checksum
 */
export const validGstin = (g: string): boolean => {
  return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g);
};

export interface InLine {
  qty: number;
  rate: number;
  discount?: number;
  gst_rate: number;
}

export type OutLine<T> = T & {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
};

/**
 * Calculate Indian Goods and Services Tax (GST) per line:
 * - Intra-state (supplier state = Place of Supply) -> CGST + SGST (50% each)
 * - Inter-state (supplier state != Place of Supply) -> IGST (100%)
 * Calculates invoice round-off line to the nearest rupee.
 */
export function computeGst<T extends InLine>(
  lines: T[],
  companyState: string,
  placeOfSupply: string,
  noTax = false
) {
  const inter = companyState !== placeOfSupply;

  const out: OutLine<T>[] = lines.map(l => {
    const taxable = r2(l.qty * l.rate - (l.discount ?? 0));
    if (taxable < 0) throw new Error('Discount cannot exceed line value');
    if (noTax || !l.gst_rate) {
      return { ...l, taxable, cgst: 0, sgst: 0, igst: 0 };
    }
    if (inter) {
      return { ...l, taxable, cgst: 0, sgst: 0, igst: r2((taxable * l.gst_rate) / 100) };
    }
    const half = r2((taxable * l.gst_rate) / 200);
    return { ...l, taxable, cgst: half, sgst: half, igst: 0 };
  });

  const taxable = r2(out.reduce((s, l) => s + l.taxable, 0));
  const cgst = r2(out.reduce((s, l) => s + l.cgst, 0));
  const sgst = r2(out.reduce((s, l) => s + l.sgst, 0));
  const igst = r2(out.reduce((s, l) => s + l.igst, 0));
  const exact = r2(taxable + cgst + sgst + igst);
  const total = Math.round(exact);

  return {
    lines: out,
    inter,
    taxable,
    cgst,
    sgst,
    igst,
    round_off: r2(total - exact),
    total,
  };
}


import { useOutletContext } from 'react-router-dom'
import ManagerOrdersPage from '../manager/ManagerOrdersPage'
import type { StaffOutletContext } from '../../components/staff/staffMode'
import './shipperOrders.css'

export default function StaffOrdersPage() {
  const { staffMode } = useOutletContext<StaffOutletContext>()
  return <div className={staffMode === 'shipper' ? 'shipper-orders-page' : undefined}><ManagerOrdersPage audience="staff" shipperOnly={staffMode === 'shipper'} /></div>
}

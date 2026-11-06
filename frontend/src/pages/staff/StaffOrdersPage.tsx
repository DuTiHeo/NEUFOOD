import { useOutletContext } from 'react-router-dom'
import ManagerOrdersPage from '../manager/ManagerOrdersPage'
import type { StaffOutletContext } from '../../components/staff/staffMode'

export default function StaffOrdersPage() {
  const { staffMode } = useOutletContext<StaffOutletContext>()
  return <ManagerOrdersPage audience="staff" shipperOnly={staffMode === 'shipper'} />
}

import { Outlet } from 'react-router-dom'
import Footer from '../components/layout/Footer.jsx'
import Navbar from '../components/layout/Navbar.jsx'

export default function PublicLayout() {
  return <>
    <Navbar />
    <main><Outlet /></main>
    <Footer />
  </>
}

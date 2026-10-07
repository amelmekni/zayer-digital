import { Route, Routes } from 'react-router-dom'
import ScrollToTop from './components/common/ScrollToTop.jsx'
import ScrollProgress from './components/common/ScrollProgress.jsx'
import PublicLayout from './layouts/PublicLayout.jsx'
import Home from './pages/public/Home.jsx'
import About from './pages/public/About.jsx'
import Services from './pages/public/Services.jsx'
import ServiceDetails from './pages/public/ServiceDetails.jsx'
import Portfolio from './pages/public/Portfolio.jsx'
import Careers from './pages/public/Careers.jsx'
import Contact from './pages/public/Contact.jsx'
import AuthPage from './pages/public/AuthPage.jsx'
import NotFound from './pages/public/NotFound.jsx'

export default function App() {
  return <>
    <ScrollProgress />
    <ScrollToTop />
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/:slug" element={<ServiceDetails />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  </>
}

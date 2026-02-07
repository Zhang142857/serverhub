import { ipcMain } from 'electron'
import { saveCertificate, getCertificate, deleteCertificate } from '../cert-store'

export function registerCertHandlers() {
  ipcMain.handle('cert:save', async (_event, serverId: string, certificate: string) => {
    saveCertificate(serverId, certificate)
    return { success: true }
  })

  ipcMain.handle('cert:get', async (_event, serverId: string) => {
    return getCertificate(serverId)
  })

  ipcMain.handle('cert:delete', async (_event, serverId: string) => {
    deleteCertificate(serverId)
    return { success: true }
  })
}

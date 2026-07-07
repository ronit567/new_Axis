import { useMutation } from '@tanstack/react-query'
import { ReportRepository, CreateReportInput } from '../repositories/ReportRepository'
import { useAuth } from '../context/AuthContext'

export function useCreateReport() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: (input: CreateReportInput) => {
      if (!user) throw new Error('Not signed in')
      return ReportRepository.create(user.id, input)
    },
  })
}

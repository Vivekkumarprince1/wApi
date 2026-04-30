import { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';

export interface StepProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  trigger?: (name?: string | string[]) => Promise<boolean>;
}

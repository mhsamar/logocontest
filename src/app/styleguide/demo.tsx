"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";

export function ToastDemo() {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => toast(t("styleguide.toastMessage"))}>
        {t("styleguide.showToast")}
      </Button>
      <Button variant="secondary" onClick={() => toast(t("auth.errors.generic"), "danger")}>
        {t("styleguide.danger")}
      </Button>
    </div>
  );
}

export function ModalDemo() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("styleguide.openModal")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("styleguide.modalTitle")}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => setOpen(false)}>{t("common.confirm")}</Button>
          </>
        }
      >
        {t("styleguide.modalBody")}
      </Modal>
    </>
  );
}

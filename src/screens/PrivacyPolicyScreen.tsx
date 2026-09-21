import { Text, Linking } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LegalDocument, { legalStyles as styles } from '../components/layout/LegalDocument';
import { SUPPORT_EMAIL } from '../constants/contact';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

export default function PrivacyPolicyScreen({ navigation }: Props) {
  return (
    <LegalDocument
      title="Privacy policy"
      lastUpdated="September 15, 2026"
      onBack={() => navigation.goBack()}
    >
      <Text style={styles.intro}>
        Axis is a marketplace built for verified university students. This policy
        explains what information we collect, how we use it, and the choices you
        have. We keep it short because you deserve to actually read it.
      </Text>

      <Text style={styles.sectionTitle}>Information we collect</Text>
      <Text style={styles.paragraph}>
        When you create an account we collect your name and your Western-issued
        @uwo.ca (or @alumni.uwo.ca) email address, which we use to confirm you
        are part of the Western community.
        As you use Axis we also store the listings you post (titles, prices,
        photos, and descriptions), the messages you send to other students, your
        profile details including an optional photo and bio, and basic activity
        such as items you save or view.
      </Text>
      <Text style={styles.paragraph}>
        We do not collect your location, your contacts, or any advertising
        identifier. Axis contains no advertising or analytics SDKs.
      </Text>

      <Text style={styles.sectionTitle}>How we use your information</Text>
      <Text style={styles.paragraph}>
        We use your information to verify your student status, show your listings
        to other buyers, deliver messages, keep the marketplace safe, and improve
        the app. We may send you service notifications about your account, your
        listings, or your conversations, and we email you a confirmation when you
        report something.
      </Text>

      <Text style={styles.sectionTitle}>How we share information</Text>
      <Text style={styles.paragraph}>
        Your name and active listings are visible to other verified students so
        they can buy from you. We do not sell your personal information, and we do
        not use it for advertising or tracking.
      </Text>
      <Text style={styles.paragraph}>
        Three service providers process data on our behalf, and all are contractually
        required to protect it: Supabase hosts our database, file storage, and
        sign-in; Resend delivers the emails about reports, including the confirmation
        sent to your email address when you file one; and Sentry receives crash
        reports when the app fails. Crash reports
        contain the technical details of the failure and your device model — never
        your name, email, messages, or listings. We share data otherwise only when
        required by law or to protect the safety of our community.
      </Text>

      <Text style={styles.sectionTitle}>How we protect it</Text>
      <Text style={styles.paragraph}>
        Photos you attach to a listing are served from a public web address, so
        anyone who has that address can open the image — that is what lets listings
        load quickly for every buyer. Your profile photo is not: it is stored
        privately and shown only to signed-in Axis members, through a link that
        expires.
      </Text>
      <Text style={styles.paragraph}>
        Your sign-in session is encrypted on your device and the key is held in the
        operating system's secure keychain. All traffic between the app and our
        servers is encrypted in transit. Access is enforced row by row in the
        database, so one account cannot read another's private data even if the app
        is modified.
      </Text>

      <Text style={styles.sectionTitle}>Data retention</Text>
      <Text style={styles.paragraph}>
        We keep your account information while your account is active. When you
        delete your account we remove your profile and listings, though we may
        retain limited records where needed to resolve disputes, prevent abuse,
        or comply with legal obligations.
      </Text>

      <Text style={styles.sectionTitle}>Your choices</Text>
      <Text style={styles.paragraph}>
        You can edit or delete your listings at any time, update your profile
        details, and block anyone you no longer want to hear from. You can delete
        your account from the Settings screen, which permanently removes your
        profile, listings, photos, and messages.
      </Text>
      <Text style={styles.paragraph}>
        Depending on where you live, you may also have the right to request a copy
        of the personal information we hold about you, to correct it, or to ask us
        to delete it. Email us and we will help.
      </Text>

      <Text style={styles.sectionTitle}>Children</Text>
      <Text style={styles.paragraph}>
        Axis is intended for university students and is not directed at children.
        We do not knowingly collect personal information from anyone under 13. If
        you believe a child has created an account, contact us and we will remove
        it.
      </Text>

      <Text style={styles.sectionTitle}>Changes to this policy</Text>
      <Text style={styles.paragraph}>
        If we change how we handle your information, we will update this policy and
        revise the date above. Significant changes will also be surfaced in the app.
      </Text>

      <Text style={styles.sectionTitle}>Contact us</Text>
      <Text style={styles.paragraph}>
        Questions about your privacy? Reach our team at{' '}
        <Text
          style={styles.emailLink}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          accessibilityRole="link"
        >
          {SUPPORT_EMAIL}
        </Text>{' '}
        and we will get back to you.
      </Text>
      <Text style={styles.paragraph}>
        The current version of this policy is always available at{' '}
        <Text
          style={styles.emailLink}
          onPress={() => Linking.openURL('https://dataaxis.org/privacy')}
          accessibilityRole="link"
        >
          dataaxis.org/privacy
        </Text>
        .
      </Text>
    </LegalDocument>
  );
}

import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import { object } from 'yup';
import { faker } from '@faker-js/faker';

import { Typeahead } from 'react-bootstrap-typeahead';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Image from 'react-bootstrap/Image';
import Form from 'react-bootstrap/Form';

import axios from 'axios';
import routes from '../../routes';

import { useAuth, useSnippets } from '../../hooks';
import { snippetName } from '../../utils/validationSchemas';
import { actions as modalActions } from '../../slices/modalSlice.js';
import icons from '../../utils/icons';

const generateGuestUserData = () => {
  const username = `guest_${faker.string.alphanumeric(5)}`;
  const email = `${username}@hexlet.com`;
  const password = `guest_${faker.internet.password()}`;
  return { username, email, password };
};

function NewSnippet({ handleClose, isOpen }) {
  const { t: tMNS } = useTranslation('translation', {
    keyPrefix: 'modals.newSnippet',
  });
  const { t: tErr } = useTranslation('translation', { keyPrefix: 'errors' });
  const { t } = useTranslation();
  const auth = useAuth();
  const dispatch = useDispatch();
  const snippetApi = useSnippets();
  const navigate = useNavigate();
  const inputRefTemplate = useRef(null);
  const inputRefName = useRef(null);
  const username = useSelector((state) => state.user.userInfo.username);
  const { supportedLanguages } = useSelector((state) => state.languages);
  const [once, setOnce] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (inputRefTemplate.current) {
      inputRefTemplate.current.focus();
    }
  }, [isOpen]);

  const validationSchema = object({
    name: snippetName(),
  });

  const formik = useFormik({
    initialValues: {
      template: '',
      name: '',
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      console.log(values);
      setSubmitting(true);
      const guestData = !auth.isLoggedIn && generateGuestUserData();
      const targetUsername = auth.isLoggedIn ? username : guestData.username;
      if (!auth.isLoggedIn) {
        try {
          await axios.post(routes.usersPath(), guestData);
          auth.signIn();
          localStorage.setItem(
            'guestUserData',
            JSON.stringify({
              guestId: guestData.password,
            }),
          );
        } catch (err) {
          if (!err.isAxiosError) {
            console.log('errors.unknown');
            throw err;
          }
          if (
            err.response?.status === 400 &&
            Array.isArray(err.response?.data?.errs?.message)
          ) {
            // случай, когда случайно сгенерировался username или email, который уже есть в базе
            console.log(tErr('network'));
            throw err;
          } else {
            console.log(tErr('network'));
            throw err;
          }
        }
      }
      const { template } = values;
      const code = t(`codeTemplates.${template}`);
      if (!supportedLanguages.includes(template)) {
        dispatch(modalActions.openModal({ type: 'inDevelopment' }));
      }
      try {
        const snipName = `${values.name}`;
        const id = await snippetApi.saveSnippet(code, snipName, template);
        const { slug } = await snippetApi.getSnippetData(id);
        const url = new URL(
          snippetApi.genViewSnippetLink(targetUsername, slug),
        );
        console.log(id, slug, url.pathname);
        formik.values.name = '';
        navigate(url.pathname);
        handleClose();
      } catch (error) {
        if (!error.isAxiosError) {
          console.log(tErr('unknown'));
          throw error;
        } else {
          console.log(tErr('network'));
          throw error;
        }
      } finally {
        formik.resetForm();
        setOnce(false);
        setSubmitting(false);
      }
    },
  });

  useEffect(() => {
    setTimeout(() => {
      if (inputRefName.current) {
        inputRefName.current.select();
      }
    }, 100);
  }, [formik.touched.name]);

  const handleModalClose = () => {
    setOnce(false);
    setIsLoading(false);
    formik.resetForm();
    handleClose();
  };

  const generateSnippetName = async () => {
    setIsLoading(true);
    try {
      const generatedName = await snippetApi.getDefaultSnippetName();
      formik.setFieldValue('name', generatedName);
      formik.setFieldTouched('name', true);
    } catch (error) {
      if (!error.isAxiosError) {
        console.log(tErr('unknown'));
        throw error;
      } else {
        console.log(tErr('network'));
        throw error;
      }
    }
    setIsLoading(false);
  };

  const handleLanguageChange = (inputValue = '') => {
    const lowerInput = inputValue.trim().toLowerCase();

    if (!lowerInput) {
      formik.setFieldValue('template', '');
      formik.setFieldTouched('name', false);
      return;
    }

    const filteredOptions = supportedLanguages.filter((language) =>
      language.toLowerCase().startsWith(lowerInput),
    );

    if (filteredOptions.length === 0) {
      formik.setFieldValue('template', '');
      return;
    }

    const selectedLanguage =
      filteredOptions.find(
        (language) => language.toLowerCase() === lowerInput,
      ) || filteredOptions[0];

    formik.setFieldValue('template', selectedLanguage);

    if (!once) {
      setOnce(true);
      generateSnippetName();
    }
  };

  const resetLanguage = () => {
    try {
      formik.setFieldValue('template', '');
      inputRefTemplate.current.focus();
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <Modal centered onHide={handleModalClose} show={isOpen}>
      <Modal.Header className="py-3 pb-0" closeButton>
        <Modal.Title className="display-6 fs-3">{tMNS('title')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="row">
          <div className="snippet-form__wrapper">
            <Form className="flex-fill" onSubmit={formik.handleSubmit}>
              <Form.Group className="d-flex">
                <div className="template-input__wrapper me-2">
                  <Form.Label>{tMNS('template')}</Form.Label>
                  <Typeahead
                    id="language"
                    labelKey="template"
                    maxResults={12}
                    onChange={([e]) => handleLanguageChange(e)}
                    options={supportedLanguages}
                    renderInput={({ referenceElementRef, ...inputProps }) => {
                      return (
                        <>
                          <Form.Control
                            ref={(node) => {
                              inputRefTemplate.current = node;
                              referenceElementRef(node);
                            }}
                            onBlur={formik.handleBlur}
                            onChange={formik.handleChange}
                            onFocus={inputProps.onFocus}
                            placeholder={inputProps.placeholder}
                            type={inputProps.type}
                            value={formik.values.template}
                            id="template"
                          />
                          {formik.values.template && (
                            <Button
                              type="button"
                              className="btn"
                              variant="link"
                              style={{
                                fontSize: '30px',
                                textDecoration: 'none',
                                position: 'absolute',
                                right: 5,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                padding: '5px',
                                color: '#6c757d',
                                zIndex: 5,
                              }}
                              onClick={resetLanguage}
                            >
                              &times;
                            </Button>
                          )}
                        </>
                      );
                    }}
                    renderMenuItemChildren={(option) => (
                      <div>
                        <Image
                          alt={t(`languages.${option}`)}
                          roundedCircle
                          src={icons.get(option)}
                          style={{
                            width: '10%',
                            height: 'auto',
                          }}
                        />
                        {`  ${option}`}
                      </div>
                    )}
                    selected={
                      formik.values.template ? [formik.values.template] : []
                    }
                  />
                </div>
                <div className="col snippetname-input__wrapper">
                  <Form.Label>{tMNS('snippetName')}</Form.Label>
                  <Form.Control
                    ref={inputRefName}
                    autoComplete="off"
                    className="transition-padding"
                    disabled={!formik.values.template || isLoading}
                    id="name"
                    isInvalid={formik.errors.name && formik.touched.name}
                    name="name"
                    onChange={formik.handleChange}
                    value={formik.values.name}
                  />
                  <Form.Control.Feedback
                    tooltip
                    type="invalid"
                    style={{
                      textDecoration: 'none',
                      position: 'absolute',
                      right: 5,
                      top: '60%',
                      opacity: '0.8',
                      transform: 'translateX(-100%) translateY(-50%)',
                      padding: '5px',
                      color: '#fff',
                      zIndex: 5,
                    }}
                  >
                    {t(formik.errors.name)}
                  </Form.Control.Feedback>
                </div>
              </Form.Group>
              <div className="d-flex flex-row-reverse pt-4">
                <Button
                  className="col-md-4 mx-6"
                  disabled={!formik.values.name || formik.isSubmitting}
                  type="submit"
                  variant="primary"
                >
                  {tMNS('create')}
                </Button>
              </div>
            </Form>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default NewSnippet;
